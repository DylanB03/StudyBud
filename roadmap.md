# StudyBud Development Roadmap Markdown

## Summary
- Use one master roadmap document with seven execution phases that follow the approved architecture plan from foundation through the full planned app.
- Build in dependency order: app shell and storage first, then PDF ingestion, then AI division extraction, then the study workspace, then chat and contextual clarification, then practice generation, then research/browser enrichment and release hardening.
- Treat every phase as a short delivery cycle with three internal iterations:
  - Iteration 1: contracts, local fixtures, and skeleton UI
  - Iteration 2: real integration and primary happy path
  - Iteration 3: regression, edge cases, and phase exit testing

## Phase 0: App Foundation
Goal: establish the desktop architecture, security model, local persistence base, and developer workflow before any study features ship.

Implementation order:
1. Scaffold `Electron + React + TypeScript + Vite` with `main`, `preload`, and `renderer` boundaries.
2. Enable `contextIsolation`, `sandbox`, strict typed IPC, and app-managed storage directories.
3. Add SQLite with Drizzle migrations and define the first schema for settings, subjects, documents, and jobs.
4. Add settings storage with encrypted API-key handling through Electron `safeStorage`.
5. Create the base shell UI: app window, subject library placeholder, settings screen, and job/status area.

Features required in this phase:
- App boots cleanly on Windows development machines.
- Settings screen can save and load provider configuration.
- Local database initializes and migrates automatically.
- Typed IPC layer is present and rejects invalid payloads.
- Basic navigation exists between library and settings.

Iteration testing:
- Iteration 1: app boot smoke test, DB migration test, IPC contract validation.
- Iteration 2: save/load API key flow, restart persistence check, first-run empty-state UX test.
- Iteration 3: packaging smoke build, invalid settings handling, security review of preload exposure.

Exit gate:
- The app can launch, persist local settings, and safely call privileged functionality only through typed IPC.

## Phase 1: Subject Import and PDF Pipeline
Goal: make subjects/classes real objects, import PDFs into managed storage, and extract enough document structure to support downstream AI work.

Implementation order:
1. Build subject creation flow and import wizard for lecture PDFs and homework PDFs.
2. Copy imported files into app-managed storage and register them in SQLite.
3. Use PDF.js to extract page count, page text, and page thumbnails.
4. Create `SourceDocument`, `Page`, and `Chunk` records and basic import job tracking.
5. Build the first document viewer with page navigation and thumbnail strip.

Features required in this phase:
- Create/open/list subjects.
- Import multiple PDFs into a subject.
- Store imported PDFs independently of original file paths.
- Render PDFs and generated thumbnails.
- Extract per-page text and save chunked text for retrieval later.
- Show import status and recover from failed document imports.

Iteration testing:
- Iteration 1: fixture-based import tests on small lecture PDFs and schema validation for stored pages/chunks.
- Iteration 2: real multi-PDF import run, reopen-after-restart validation, viewer navigation checks.
- Iteration 3: large-PDF performance pass, duplicate import behavior, corrupted/unsupported PDF handling.

Exit gate:
- A user can create a subject, import PDFs, reopen the subject later, and browse stored pages without depending on the original files.

## Phase 2: AI Ingestion and Division Extraction
Goal: transform raw documents into divisions, key concepts, and problem types with source-page traceability.

Implementation order:
1. Define structured output schemas for divisions, key concepts, problem types, and unassigned pages.
2. Add ingestion jobs that send chunked document context to the AI pipeline.
3. Generate embeddings for stored chunks and persist them locally.
4. Save `Division`, `ProblemType`, and source-page links in the database.
5. Build ingestion progress UI and recovery states for failed or partial jobs.

Features required in this phase:
- Run AI ingestion per subject.
- Produce divisions with summaries and linked source pages.
- Detect problem types for each division.
- Mark pages the model could not confidently assign.
- Support retrying ingestion without destroying prior source documents.

Iteration testing:
- Iteration 1: mock-model schema tests and division persistence tests using fixed outputs.
- Iteration 2: real ingestion on a sample STEM course pack, manual review of division quality and page linkage.
- Iteration 3: retry and failure-path testing, token/cost guardrails, regression checks for multi-document subjects.

Exit gate:
- Imported study material becomes a structured subject with reliable divisions, problem types, and source-page mappings.

## Phase 3: Division Workspace and Citation Previews
Goal: turn the extracted divisions into a usable study workspace with visual evidence for every summary.

Implementation order:
1. Build the left sidebar division navigator.
2. Create the division detail view with summary, key concepts, and source references.
3. Introduce `CitationRef` objects that carry page number, thumbnail, excerpt, and optional text bounds.
4. Render citation cards with thumbnail preview, document name, page number, and excerpt.
5. Link citation clicks to the PDF viewer and highlight the referenced text when coordinates are available.

Features required in this phase:
- Division list navigation.
- Division summary and concept display.
- Visual citation cards for summary grounding.
- Hover preview enlargement.
- Jump-to-page behavior in the PDF viewer.

Iteration testing:
- Iteration 1: static citation-card rendering against fixtures and navigation wiring tests.
- Iteration 2: end-to-end summary-to-citation-to-page flow on real subject data.
- Iteration 3: citation accuracy review, wrong-page regression checks, and UI polish for dense citation sets.

Exit gate:
- A user can study any division and immediately see the actual slides/pages that support the summary.

## Phase 4: Grounded Chat and Contextual Clarification
Goal: let users ask questions about a division or any selected text and receive grounded answers with the same visual citation behavior.

Implementation order:
1. Add division-scoped chat history and `chat.ask`.
2. Build retrieval flow using local chunk search plus embeddings rerank.
3. Add text-selection capture from summaries and PDF text layers.
4. Define `SelectionContext` and `GroundedAnswer` contracts.
5. Reuse the citation card system inside chat answers and contextual explanations.

Features required in this phase:
- Division chat pane.
- Follow-up chat within the same division context.
- Highlight text in summary or PDF and ask “explain this.”
- Answers include citations, not unsupported free text.
- Saved chat history under each subject/division.

Iteration testing:
- Iteration 1: retrieval unit tests and mocked grounded-answer rendering.
- Iteration 2: real question-answer flows on sample course packs, including selected-text explanations.
- Iteration 3: hallucination review, out-of-scope question handling, conversation persistence and restart validation.

Exit gate:
- The app can answer study questions about a division or selected text while showing supporting page previews for the response.

## Phase 5: Practice Generation and Saved Study State
Goal: generate similar practice problems by problem type and difficulty, with hidden answers and follow-up explanations.

Implementation order:
1. Add practice generation UI for problem type, difficulty, and question count.
2. Define and validate the practice-set output schema.
3. Persist generated questions, hidden answers, and reveal state.
4. Add “explain this question” and “explain this answer” actions using the same contextual pipeline.
5. Ensure full subject state restoration across app restarts.

Features required in this phase:
- Generate `n` easy, medium, or hard questions per problem type.
- Hidden answer key reveal per question.
- Saved practice history per division.
- Contextual explanation flow from a question or revealed answer.
- Full persistence of subjects, divisions, chats, and practice sets.

Iteration testing:
- Iteration 1: schema tests for generated practice output and reveal-state persistence tests.
- Iteration 2: real generation quality review across difficulties and problem types.
- Iteration 3: restart regression tests, explanation-flow tests, and malformed-output recovery.

Exit gate:
- A student can study a division, generate targeted practice, reveal answers on demand, and return later without losing work.

## Phase 6: Research Enrichment and In-App Browser
Goal: add the broader clarification workflow with web search, in-app reading, and external video suggestions.

Implementation order:
1. Add follow-up enrichment fields to grounded answers: suggested search queries and video queries.
2. Integrate web search results in a right-side research drawer.
3. Add an in-app browser host using Electron `WebContentsView`.
4. Support browser navigation controls and safe remote-content isolation.
5. Integrate video suggestions with thumbnail cards that open externally to YouTube.

Features required in this phase:
- Search suggestions tied to the current question or selected text.
- In-app browser pane for reading relevant sites.
- Video suggestion cards with thumbnails and outbound links.
- Research drawer that coexists with summary/chat/practice workflows.
- Security boundaries that prevent remote pages from accessing Node or privileged IPC.

Iteration testing:
- Iteration 1: browser host layout tests and search-result rendering using mocked providers.
- Iteration 2: real search and browsing flow tests, external YouTube link behavior, and citation-to-research continuity.
- Iteration 3: security regression checks for remote content, navigation edge cases, and blocked/broken site behavior.

Exit gate:
- The app supports a full clarification loop: AI explanation, related web reading in-app, and relevant video suggestions out-of-app.

## Phase 7: Release Hardening and MVP Delivery
Goal: make the full planned app stable enough to package, demo, and iterate on with real student usage.

Implementation order:
1. Improve loading, error, and retry states across ingestion, chat, practice, and research flows.
2. Add unsupported-document messaging for scanned/image-only PDFs.
3. Run Windows packaging and installer validation.
4. Complete end-to-end acceptance testing on a small set of real course packs.
5. Prepare release checklist, known limitations, and issue triage categories.

Features required in this phase:
- Polished empty/loading/error states.
- Clear messaging for unsupported or low-confidence ingestion results.
- Installer-ready Windows build.
- Stable reopen behavior for long-lived subjects.
- Documented MVP limitations and support expectations.

Iteration testing:
- Iteration 1: UX pass on error states and first-run flow.
- Iteration 2: installer and upgrade smoke tests, invalid API key and offline behavior checks.
- Iteration 3: full regression suite, exploratory study-session testing, and sign-off against the roadmap acceptance criteria.

Exit gate:
- The app is usable end to end by a test student on Windows and ready for controlled MVP rollout.

## Public Interfaces Introduced By Phase
- Phase 0: `settings.saveProviderKeys`
- Phase 1: `subjects.create`, `subjects.import`, `subjects.list`, `subjects.open`
- Phase 2: `ingestion.start`, `ingestion.getStatus`, `DivisionExtractionResult`
- Phase 3: `divisions.getWorkspace`, `CitationRef`
- Phase 4: `chat.ask`, `SelectionContext`, `GroundedAnswer`
- Phase 5: `practice.generate`, `practice.list`, `practice.reveal`
- Phase 6: `research.search`, `research.openUrl`

## Test Strategy Across Iterations
- Use a fixed course-pack fixture set for regression: at least one lecture-heavy course, one homework-heavy course, and one mixed STEM course.
- Keep two validation lanes in every phase:
  - fixture/mocked tests for deterministic contract checks
  - real integration tests for AI quality and end-to-end workflow safety
- Do not advance a phase until its exit gate passes on both a fresh install and a reopen-after-restart scenario.

## Assumptions And Defaults
- The roadmap covers the full planned app, not just the core MVP.
- Windows is still the first supported OS; macOS and Linux are deferred.
- AI remains cloud-based with user-supplied API keys.
- Digital text PDFs are the supported input format for the first release; OCR and scanned-document-first support stay out of scope.
