# StudyBud Codex Context

## Purpose
This file is the practical handoff note for future implementation passes.

It tracks:
- what is actually implemented now
- what changed recently
- what diverged from the original roadmap/plan
- the current risks, limitations, and likely next moves

It should stay grounded in the repo and the current product state, not the idealized future app.

## Current Repo / Environment Notes
- Current repo path in this session: `/home/dylan/projects/studybud`
- The project has also previously lived at `/home/dylan/Gitrepos/allrepos/StudyBud`
- The app is often run inside `WSL2`, even though the product target is still Windows-first
- That matters for:
  - Electron external-link behavior
  - native module rebuilds
  - local Ollama access if Ollama is hosted on Windows while Electron runs in WSL

## Project Status
- Current implemented phases:
  - Phase 0: implemented
  - Phase 1: implemented
  - Phase 2: implemented
  - Phase 3: implemented
  - Phase 4: implemented
  - Phase 5: implemented and hardened
  - Phase 6: implemented and improved
- Not yet implemented:
  - Phase 7 release hardening from the roadmap

## What The App Can Do Now
- Electron desktop app with `main`, `preload`, and `renderer` separation
- React renderer with typed IPC bridge
- local SQLite persistence
- subject creation, reopening, and deletion
- lecture/homework PDF import into app-managed storage
- PDF text extraction and chunking
- PDF viewing and extracted page-text inspection
- failed/imported document deletion
- subject analysis into:
  - divisions
  - key concepts
  - problem types
  - unassigned pages
- division-first workspace
- citation preview cards tied to source pages
- click-through from citations into the PDF viewer
- focused citation evidence with excerpt-aware source context
- division-scoped grounded chat
- selection-based clarification across analysis/chat/practice text
- right-side chat/answer rail inside the workspace
- persisted chat history per division
- generated practice sets per division/problem type/difficulty
- hidden answer keys with persisted reveal/hide state
- practice question / answer explanation through grounded chat
- saved practice history per subject/division
- practice set source-page persistence for later explanations
- practice set collapse / regenerate / delete controls
- provider-based AI configuration:
  - OpenAI
  - local Ollama
- research workflow:
  - suggested web/video queries from grounded answers
  - Research tab in the right rail
  - web search results
  - video suggestions
  - in-app browser
  - open website externally
  - open video externally
  - remote PDF-aware research browsing fallback
- optional research provider settings:
  - Brave Search API
  - YouTube Data API
  - research safety mode

## General Structure
- Main process entry: [src/main.ts](/home/dylan/projects/studybud/src/main.ts)
- Preload bridge: [src/preload.ts](/home/dylan/projects/studybud/src/preload.ts)
- Shared IPC contracts: [src/shared/ipc.ts](/home/dylan/projects/studybud/src/shared/ipc.ts)
- Shared browser-global typing: [src/shared/global.d.ts](/home/dylan/projects/studybud/src/shared/global.d.ts)
- Main database layer: [src/main/db/database.ts](/home/dylan/projects/studybud/src/main/db/database.ts)
- DB schema: [src/main/db/schema.ts](/home/dylan/projects/studybud/src/main/db/schema.ts)
- Import pipeline:
  - worker launcher: [src/main/documents/import-process.ts](/home/dylan/projects/studybud/src/main/documents/import-process.ts)
  - worker entry: [src/main/documents/import-worker.ts](/home/dylan/projects/studybud/src/main/documents/import-worker.ts)
  - import logic: [src/main/documents/import.ts](/home/dylan/projects/studybud/src/main/documents/import.ts)
- PDF extraction: [src/main/pdf/extraction.ts](/home/dylan/projects/studybud/src/main/pdf/extraction.ts)
- AI provider layer:
  - provider switch: [src/main/ai/provider.ts](/home/dylan/projects/studybud/src/main/ai/provider.ts)
  - OpenAI client: [src/main/ai/openai.ts](/home/dylan/projects/studybud/src/main/ai/openai.ts)
  - Ollama client: [src/main/ai/ollama.ts](/home/dylan/projects/studybud/src/main/ai/ollama.ts)
- Subject analysis: [src/main/analysis/subject-analysis.ts](/home/dylan/projects/studybud/src/main/analysis/subject-analysis.ts)
- Citation excerpt helper: [src/main/analysis/citation-excerpts.ts](/home/dylan/projects/studybud/src/main/analysis/citation-excerpts.ts)
- Grounded chat service: [src/main/chat/grounded-chat.ts](/home/dylan/projects/studybud/src/main/chat/grounded-chat.ts)
- Practice generation service: [src/main/practice/practice-generation.ts](/home/dylan/projects/studybud/src/main/practice/practice-generation.ts)
- Research search service: [src/main/research/search.ts](/home/dylan/projects/studybud/src/main/research/search.ts)
- Research browser controller: [src/main/research/browser.ts](/home/dylan/projects/studybud/src/main/research/browser.ts)
- WSL-aware external opener: [src/main/system/open-external.ts](/home/dylan/projects/studybud/src/main/system/open-external.ts)
- AI JSON repair helper: [src/main/ai/json-repair.ts](/home/dylan/projects/studybud/src/main/ai/json-repair.ts)
- Renderer root: [src/renderer.tsx](/home/dylan/projects/studybud/src/renderer.tsx)
- Main UI: [src/ui/App.tsx](/home/dylan/projects/studybud/src/ui/App.tsx)
- PDF viewer UI: [src/ui/PdfViewer.tsx](/home/dylan/projects/studybud/src/ui/PdfViewer.tsx)
- Citation preview UI: [src/ui/CitationPreviewCard.tsx](/home/dylan/projects/studybud/src/ui/CitationPreviewCard.tsx)
- Division chat UI: [src/ui/DivisionChatPanel.tsx](/home/dylan/projects/studybud/src/ui/DivisionChatPanel.tsx)
- Practice UI: [src/ui/PracticePanel.tsx](/home/dylan/projects/studybud/src/ui/PracticePanel.tsx)
- Research UI: [src/ui/ResearchPanel.tsx](/home/dylan/projects/studybud/src/ui/ResearchPanel.tsx)
- Rich markdown/math renderer: [src/ui/RichMessageContent.tsx](/home/dylan/projects/studybud/src/ui/RichMessageContent.tsx)
- Selection popup UI: [src/ui/SelectionQuestionPopup.tsx](/home/dylan/projects/studybud/src/ui/SelectionQuestionPopup.tsx)
- Selection chip UI: [src/ui/SelectionAskChip.tsx](/home/dylan/projects/studybud/src/ui/SelectionAskChip.tsx)
- Styling: [src/index.css](/home/dylan/projects/studybud/src/index.css)

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
- selected-text clarification from analysis-derived text, extracted page text, chat text, and practice text
- right-side chat/answer rail in the workspace
- contextual selection UI:
  - lightweight `Ask about this` chip on text selection
  - popup question composer near the selection
  - answers land in the persistent chat rail
- markdown and math rendering for assistant responses

### Phase 5
- generated practice sets by division problem type and difficulty
- persisted practice sets and questions in SQLite
- hidden answer keys with persisted reveal/hide state
- practice question / answer explanation through the same grounded chat system
- practice set source-page persistence so explanations can use actual generation evidence
- practice set management in the workspace:
  - collapse
  - regenerate
  - delete
- malformed-output recovery for imperfect model responses

### Phase 6
- suggested search/video queries returned from grounded answers
- Research tab in the workspace right rail
- web search results and video suggestions
- in-app browser with back/forward/reload/open/hide
- website and browser-page external open actions
- video suggestions open externally
- PDF-aware browser behavior and fallback messaging
- loading/error overlays inside the research browser host
- query provenance from the latest assistant answer
- `Back To Results` workflow within the Research panel
- optional API-backed research providers:
  - Brave Search API
  - YouTube Data API
- fallback scraping-based search when API keys are absent
- research safety mode:
  - `balanced`
  - `education`

## Major Changes Added Outside The Original Roadmap / Plan

### Provider Abstraction
Off-plan relative to the original OpenAI-only MVP assumption.

Implemented:
- provider setting: `openai | ollama`
- persistent Ollama config:
  - base URL
  - model name
- provider-specific request routing in the main process

Why it exists:
- local testing and lower-cost development
- explicit user request to support local Ollama

### Session-Only Secret Mode
Off-plan relative to the original secure-storage assumption.

Implemented:
- if `safeStorage` is unavailable, OpenAI and research API keys can still be used for the current app session
- these values are kept in memory only and not written to disk

Why it exists:
- otherwise settings flows become blocked on some environments

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
Not a dedicated roadmap item, but necessary stabilization for the current AI flows.

Implemented:
- live in-app analysis-running banner
- provider/model display for analysis jobs
- elapsed timer while analysis is running
- clearer Ollama timeout/reachability errors

Why it exists:
- otherwise analyze felt like a hang with no observability

### Workspace-Focused Layout Mode
Not explicitly called out in the roadmap, but strongly aligned with the intended study workflow.

Implemented:
- global left app sidebar disappears while inside a subject workspace
- workspace becomes a focused study layout
- right-side chat/answer rail replaces the older bottom-stacked answer area
- resizable divider between workspace and right rail

Why it exists:
- user-requested
- better matches the intended “inside a subject” study mode

### Rich Rendering / Selection UX
Not explicitly called out in the roadmap, but important for making the study experience usable.

Implemented:
- markdown rendering in chat and related assistant surfaces
- KaTeX-backed math rendering
- fallback superscript/subscript handling for plain-text model output
- grounding collapsed by default behind an expandable row
- chat-message text is highlightable for follow-up questions
- selection-based clarification starts from a lightweight inline chip and popup

Why it exists:
- user-requested
- raw markdown/math output was too literal and hard to study from

### Research Reliability Work
Partly roadmap-aligned, partly iterative hardening after the initial Phase 6 implementation.

Implemented:
- loading/error overlays in the research browser area
- browser error fallback actions
- WSL-aware external opening
- provider-backed research APIs with scraping fallback
- suggestion provenance block based on the latest answer
- provenance block now uses the same markdown/math renderer as the rest of the assistant UI

Why it exists:
- the first Research pass was useful but too brittle and opaque

## Important Fixes Already Made

### Main Process / Startup
- fixed missing-preload / browser-open behavior so the app fails gracefully outside Electron
- removed stray extra dev window behavior
- added single-instance focusing
- registered IPC handlers immediately and made handlers wait for initialization
- improved startup sequencing to avoid `No handler registered` races
- hardened IPC registration to clear and re-register handlers on startup/reload

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

### AI / Analysis / Chat
- fixed provider gating so `Analyze Subject` works in Ollama mode without requiring an OpenAI key
- fixed OpenAI structured-output schema mismatch for `unassignedRefs.reason`
- analysis jobs now persist provider/model metadata
- improved Ollama failures from generic hangs to more specific timeout/reachability errors
- fixed detached `ArrayBuffer` errors during homework analysis / citation preview rendering by cloning PDF bytes before passing them to PDF.js consumers
- strengthened citation excerpts and highlight text from stored page content
- fixed a citation-navigation state bug where switching documents from a citation could snap the viewer back to page 1
- changed grounded chat prompting and sanitization so synthetic PAGE refs stay out of visible answer text while grounding still appears separately
- added markdown + math rendering so assistant answers read as study content instead of raw markdown

### Practice / Phase 5
- answer reveal state is toggleable, not one-way
- practice generation recovers from fenced/partially malformed JSON instead of failing eagerly
- practice sets persist their own source-page refs rather than relying only on division-level source sets
- practice sets can be collapsed, regenerated, and deleted

### Research / Phase 6
- browser state now tracks source URL, content kind, and browser error state
- in-app browser no longer relies on deprecated `webContents.canGoBack/canGoForward`
- browser attachment became idempotent to avoid listener leaks
- website result clicks can open externally
- video suggestions use external-open paths rather than embedded browser behavior
- research panel scrolling is scoped to the panel instead of the whole page
- remote PDF handling has a more explicit fallback path
- suggestion provenance now renders with the same rich markdown/math component as other assistant content

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

Research state is currently mostly runtime/UI-driven rather than deeply persisted.

## Current IPC Surface
Implemented channels in [src/shared/ipc.ts](/home/dylan/projects/studybud/src/shared/ipc.ts):
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
- `research:search`
- `research:navigate`
- `research:back`
- `research:forward`
- `research:reload`
- `research:set-bounds`
- `research:hide-browser`
- `research:open-external`
- `research:browser-state`
- `documents:delete`
- `documents:detail`
- `documents:data`

## Current UX Notes
- The app is beyond a viewer/import scaffold and now behaves like a real study workspace
- The subject workspace is now a focused mode:
  - left workspace column for divisions/documents
  - center study content and PDF work area
  - right rail for chat/research
- The workspace/main vs right rail split is resizable
- Selection-based clarification starts from a lightweight inline chip and popup instead of a stagnant bottom composer
- Citation preview cards, focused evidence, grounded chat, Practice Studio, and Research are all present
- The app still feels like a strong internal MVP / engineering build rather than a polished consumer study product

## Known Limitations
- No OCR support
- No embeddings/retrieval yet
- Ollama analysis still uses a fairly heavy single-pass structured extraction prompt
  - likely too demanding for weaker local models on large subjects
- Grounded chat currently uses a relatively simple retrieval strategy over division source pages/chunks rather than a stronger embedding-backed retriever
- Practice generation is provider-aware, but still uses a single-pass generation approach and would likely benefit from stronger provider-specific prompting/templates for weaker local models
- Research API integration is present, but it currently depends on user-supplied API keys; without them, fallback scraping remains the safety net
- Research UI/runtime state is not deeply persisted yet
- Streaming is not implemented yet
  - progress visibility exists
  - token-by-token/partial-response UX does not
- Analysis currently sends parsed page/chunk text, not PDF files
- WSL/Windows hybrid dev environments can still create edge cases around local services and native dependencies

## Current Validation Status
Recent verification commonly succeeded with:
- `npm run lint`
- `npm run typecheck`
- `npm run package`

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

Important caveat:
- `npm test` remains somewhat environment-sensitive because `better-sqlite3` rebuild state can diverge between Node and Electron contexts on different machines
- during the latest Phase 6 improvement pass:
  - `npm run typecheck` passed
  - `npm run lint` passed
  - `npm run package` passed
  - `npm test` was bottlenecked by a long native `better-sqlite3` rebuild in this environment rather than a TypeScript/lint/package failure in the app code

## Recommended Next Steps
1. Start Phase 7 release hardening.
   - more polished loading/empty/error states
   - manual cross-platform smoke testing
   - tighter installer/release behavior
2. Strengthen the current grounded-chat retrieval path.
   - better relevance ranking
   - stronger citation selection
   - eventual embedding-backed retrieval
3. Stabilize local-model use with an Ollama-friendly analysis path.
   - smaller prompts
   - fewer pages per call
   - likely multi-pass analysis instead of one heavy structured pass
4. Add stronger persistence and management for Research.
   - optional saved research sessions per division
   - history of opened sources
   - maybe pin/favorite sources
5. Continue improving practice quality and control.
   - provider-specific practice prompting/templates
   - optional practice-set export / print flow
   - stronger per-question source grounding
6. Keep native rebuild friction on fresh environments as a standing maintenance concern.

## Practical Dev Notes
- Run the desktop app with `npm run dev`, not by opening the Vite page directly in a browser
- Fully restart Electron after main-process, preload, worker, browser-controller, or AI client changes
- If a new IPC channel appears to exist in code but not at runtime, suspect a stale Electron main process first and fully restart `npm run dev`
- Native rebuild direction still matters:
  - Electron runtime: `npm run rebuild:native:electron`
  - Vitest runtime: `npm run rebuild:native:node`
- If local Ollama works from shell but not in-app, compare:
  - the runtime environment where Electron is actually running
  - the configured base URL in Settings
  - whether the app is in WSL while Ollama is hosted on Windows

## Relationship To Planning Docs
- Product architecture plan: [studybud-plan.md](/home/dylan/projects/studybud/studybud-plan.md)
- Phase-by-phase roadmap: [roadmap.md](/home/dylan/projects/studybud/roadmap.md)

## Summary Judgment
The codebase is no longer a scaffold. The most accurate high-level description now is:
- solid Phase 0
- solid Phase 1
- solid Phase 2
- solid Phase 3
- solid Phase 4
- solid Phase 5
- real Phase 6 with iterative reliability and UX improvements layered on top

Future work should treat the current provider abstraction, data-path configuration, analysis diagnostics, division-first workspace, citation-focus flow, grounded chat flow, Practice Studio, selection popup UX, resizable workspace split, subject/practice deletion flows, and Research workflow as established parts of the app, even though not all of them were part of the original MVP assumptions.
