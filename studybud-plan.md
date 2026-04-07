# StudyBud Desktop MVP Architecture Plan

## Summary
- Build a Windows-first, local-first desktop app for STEM students to import lecture PDFs and homework PDFs, organize them into AI-created divisions, study summarized material, chat over each division, generate practice problems, and reopen saved subjects/classes later.
- Target a functional MVP first: digital text PDFs only, no login/sync, no OCR-first scanned-document support, user-supplied API keys, and no companion backend.
- Revise the citation UX so summaries and chat answers show actual visual previews of cited slides/pages, not just page numbers.

## Recommended Stack
- Desktop shell: `Electron 40.x` + `Electron Forge`.
- Frontend: `React + TypeScript + Vite + TanStack Router + TanStack Query + Zustand + Tailwind CSS + Radix UI`.
- Persistence: `SQLite` with `Drizzle ORM`; use `FTS5` for keyword search and store embeddings locally for semantic retrieval.
- PDF handling: `PDF.js` for page rendering, text-layer extraction, coordinates, and citation thumbnails.
- AI: OpenAI `Responses API` with Structured Outputs, `gpt-5-mini` by default, optional higher-quality mode on `gpt-5.4-mini`, and `text-embedding-3-small` for retrieval.
- Secrets/security: Electron `safeStorage`, `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, strict typed IPC.

## Key Implementation Changes
- Subject library and workspace:
  - Provide a subject/class library screen and a workspace screen.
  - Copy imported PDFs into app-managed storage so saved subjects reopen independently of original file paths.
- Ingestion and knowledge structure:
  - Create `Subject -> SourceDocument -> Page -> Chunk -> Division -> ProblemType -> PracticeSet` records.
  - Extract page text and page thumbnails with PDF.js.
  - Run AI ingestion to produce divisions, key concepts, and problem types, each linked back to source page IDs.
- Revised citation and reference behavior:
  - Every AI summary and division-chat answer must return citations tied to source pages.
  - Each citation is shown as a compact card with:
    - page thumbnail image
    - document name
    - page number
    - short supporting excerpt text
  - Clicking a citation opens the PDF viewer on that exact page.
  - Hovering a citation enlarges the preview.
  - MVP grounding is page-level, not region-cropped screenshot-level. If text coordinates are available, highlight the matching excerpt in the full-page viewer after navigation.
- Division workspace layout:
  - Left sidebar lists divisions.
  - Main content shows the division summary and key concepts.
  - A citation rail or inline citation cards show the visual source pages used by the summary.
  - A division chat pane answers questions about the current division and uses the same citation-preview cards.
- Contextual clarification:
  - Text selection from summaries, PDF text layers, practice questions, or revealed answers opens an “Ask about this” flow grounded on the selected text plus nearby chunks.
  - The AI answer includes its own explanation plus cited page-preview cards from the local documents.
- Practice generation:
  - For each division, expose detected problem types.
  - User chooses problem type, difficulty (`easy | medium | hard`), and count.
  - Generate saved practice sets with hidden answer keys; clicking reveals each answer.
  - Any practice question or revealed answer can be sent into the same contextual explanation flow.
- Phase 2 research enrichment:
  - Add web search results, an in-app browser pane, and video suggestions after the core study workflow is stable.
  - Use `Brave Search API` for search and `YouTube Data API` for video results; keep YouTube links external.

## Public Interfaces / Contracts
- `DivisionExtractionResult`
  - `divisions[]`, `problemTypes[]`, `unassignedPages[]`
  - each division includes `id`, `title`, `summary`, `keyConcepts[]`, `sourcePageIds[]`, `problemTypeIds[]`
- `CitationRef`
  - `documentId`, `pageId`, `pageNumber`, `thumbnailAssetPath`, `excerptText`, `textBounds?`
- `GroundedAnswer`
  - `answerMarkdown`, `citations: CitationRef[]`, `followups[]`, `suggestedSearchQueries[]`, `suggestedVideoQueries[]`
- `SelectionContext`
  - `kind`, `subjectId`, `divisionId?`, `pageId?`, `questionId?`, `selectedText`, `surroundingText`, `sourcePageIds[]`
- Typed IPC services:
  - `settings.saveProviderKeys`
  - `subjects.create/import/list/open`
  - `ingestion.start/getStatus`
  - `divisions.getWorkspace`
  - `chat.ask`
  - `practice.generate/list/reveal`
  - `research.search/openUrl` for Phase 2

## Test Plan
- Import multiple lecture PDFs and one homework PDF; verify divisions, concepts, and problem types are created and linked to source pages.
- Open a division summary and confirm citations render as thumbnail cards with document name, page number, and excerpt text.
- Click a citation card and verify the PDF viewer opens the correct page; if coordinates exist, verify the relevant excerpt is highlighted.
- Ask a division chat question and verify the answer includes visual page previews, not page-number-only citations.
- Highlight text in a summary and in a PDF page; verify contextual answers remain grounded to the current division and include citation previews.
- Generate easy, medium, and hard practice sets; verify hidden answer reveal, explanation flow, and persistence after app restart.
- Reopen the app and confirm subjects, PDFs, divisions, summaries, chats, citation thumbnails, and practice sets persist.

## Assumptions And Defaults
- MVP is OpenAI-only, Windows-first, local-only, and requires internet access for AI calls.
- Citation UX in MVP is page-level visual evidence with thumbnails plus excerpts; it does not require per-sentence screenshot crops.
- No login, sync, collaboration, OCR-first pipeline, handwritten math recognition, or scanned-PDF-first support in MVP.
- Web search, in-app browser, and video recommendations remain Phase 2 so Phase 1 can ship the study loop sooner.

## References
- Electron security: [electronjs.org/docs/latest/tutorial/security](https://www.electronjs.org/docs/latest/tutorial/security)
- Electron web embeds: [electronjs.org/docs/latest/tutorial/web-embeds](https://www.electronjs.org/docs/latest/tutorial/web-embeds)
- Electron local secret storage: [electronjs.org/docs/latest/api/safe-storage](https://www.electronjs.org/docs/latest/api/safe-storage)
- SQLite FTS5: [sqlite.org/fts5.html](https://sqlite.org/fts5.html)
- PDF.js: [mozilla.github.io/pdf.js/getting_started/index.html](https://mozilla.github.io/pdf.js/getting_started/index.html)
- OpenAI models: [developers.openai.com/api/docs/models](https://developers.openai.com/api/docs/models)
- YouTube Data API search: [developers.google.com/youtube/v3/docs/search/list](https://developers.google.com/youtube/v3/docs/search/list)
