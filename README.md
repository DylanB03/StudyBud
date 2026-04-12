# StudyBud

StudyBud is an Electron desktop app for turning lecture PDFs and homework PDFs into a structured study workspace.

At a high level, the app lets a student:
- create subjects/classes
- import lecture and homework PDFs into each subject
- extract readable text from those PDFs
- run AI analysis to break the material into divisions/study units
- browse cited lecture/homework pages for each division
- ask grounded questions about a division or highlighted text
- generate practice problems by problem type and difficulty
- research related websites and videos from inside the workspace

## What StudyBud Does

StudyBud is designed around a local workspace with AI-assisted study features layered on top.

Current implemented capabilities:
- subject library with create, open, and delete
- local persistence with SQLite
- lecture/homework PDF import into app-managed storage
- PDF page rendering and extracted page text previews
- AI subject analysis into:
  - divisions
  - summaries
  - key concepts
  - problem types
  - unassigned pages
- division-first study workspace
- cited source-page previews with click-through into the PDF viewer
- grounded division chat
- selection-based clarification from:
  - division summaries
  - key concepts
  - problem types
  - cited excerpts
  - extracted page text
  - division chat messages
  - practice questions and answers
- practice generation by problem type and difficulty
- reveal/hide answer keys
- research tab with:
  - suggested web queries
  - suggested video queries
  - in-app browser
  - external website/video opening

## Current Product Status

Implemented roadmap phases:
- Phase 0: foundation
- Phase 1: import + PDF pipeline
- Phase 2: AI subject analysis
- Phase 3: division workspace + citations
- Phase 4: grounded chat + selection clarification
- Phase 5: practice generation
- Phase 6: research workflow
- Phase 7: release hardening and UX stabilization

Important limitations:
- OCR is not implemented
- scanned/image-only PDFs may import but provide limited AI usefulness
- AI quality depends heavily on provider/model choice
- Windows is the primary intended target
- running inside WSL works for development but adds extra edge cases

## Tech Stack

- Electron
- React
- TypeScript
- Vite
- SQLite
- Drizzle ORM
- PDF.js
- OpenAI and/or local Ollama

## Repository Structure

Main entry points:
- `src/main.ts`: Electron main process
- `src/preload.ts`: typed preload bridge
- `src/shared/ipc.ts`: shared IPC contracts
- `src/ui/App.tsx`: main renderer workspace
- `src/main/db/database.ts`: persistence layer
- `src/main/documents/import.ts`: document import pipeline
- `src/main/pdf/extraction.ts`: PDF text extraction
- `src/main/analysis/subject-analysis.ts`: division analysis
- `src/main/chat/grounded-chat.ts`: grounded chat
- `src/main/practice/practice-generation.ts`: practice generation
- `src/main/research/search.ts`: research search/video workflow

Supporting project docs:
- [roadmap.md](./roadmap.md)
- [release-readiness.md](./release-readiness.md)
- [codex-context.md](./codex-context.md)

## Prerequisites

Required:
- Node.js
- npm

Usually needed for local development:
- a working Electron/native module toolchain
- `better-sqlite3` native rebuild support

Optional AI providers:
- OpenAI API key
- or local Ollama running on `http://localhost:11434`

Optional research providers:
- Brave Search API key
- YouTube Data API key

## Install

From the repo root:

```bash
npm install
```

If native dependencies need repair for Node-side tests:

```bash
npm run rebuild:native:node
```

If native dependencies need repair for the Electron runtime:

```bash
npm run rebuild:native:electron
```

## Launch

Development launch:

```bash
npm run dev
```

This launches the Electron desktop app.

You should not open the Vite renderer URL directly in a browser and expect the app to work normally. StudyBud relies on Electron preload APIs.

Packaged dev build:

```bash
npm run package
```

Installer/make step:

```bash
npm run make
```

## Verification Commands

Typecheck:

```bash
npm run typecheck
```

Lint:

```bash
npm run lint
```

Prepared test run:

```bash
npm run test:prepared
```

Full local verification:

```bash
npm run verify
```

## Setup Guide

### 1. Launch StudyBud

Run:

```bash
npm run dev
```

### 2. Open Settings

Configure:
- AI provider
- AI credentials/model
- optional research provider keys
- optional custom data path

### 3. Choose an AI Provider

OpenAI:
- select `OpenAI`
- enter an API key
- save settings

Ollama:
- select `Ollama (local)`
- keep `http://localhost:11434` unless your server is elsewhere
- enter the local model name, for example `qwen3:8b`
- save settings

### 4. Create a Subject

From the library:
- create a new subject/class
- open it into the workspace

## Usage Guide

### Import PDFs

Inside a subject workspace:
- import lecture PDFs
- import homework PDFs

StudyBud copies imported files into its own managed data directory and extracts page text/chunks for later AI use.

### Review Imported Documents

After import you can:
- open a document
- view its PDF pages
- inspect extracted page text
- remove failed/unwanted documents

If a PDF is scanned or image-only, the app may warn that text extraction is limited.

### Run Subject Analysis

Click `Analyze Subject`.

StudyBud will:
- gather imported ready documents
- send extracted text to the configured AI provider
- generate divisions, key concepts, problem types, and unassigned pages
- save the analysis locally

Note:
- importing new PDFs only processes those new files
- running analysis re-analyzes the full set of ready subject documents and replaces the saved division analysis

### Study By Division

Once analysis completes:
- use the division navigator to move between study units
- read the division summary
- review key concepts
- inspect problem types
- click referenced lecture/homework pages to jump to the PDF viewer

### Ask Questions

Use Division Chat to ask broad questions about the current division.

You can also highlight text from many places and use `Ask about this`, including:
- division summary
- key concepts
- problem types
- cited excerpts
- extracted page text
- chat messages
- practice questions
- practice answers

Answers appear in the right-side chat rail and can include expandable grounding citations.

### Generate Practice

For the selected division:
- choose a detected problem type
- choose `easy`, `medium`, or `hard`
- choose how many questions to generate
- generate a saved practice set

You can then:
- reveal an answer
- hide it again
- ask for a question explanation
- ask for an answer explanation
- regenerate a set
- delete a set

### Use Research

The `Research` tab can:
- run web searches
- show suggested search queries from recent AI answers
- show suggested videos
- open websites in the in-app browser
- open websites externally
- open videos externally in your default browser

## AI Provider Notes

### OpenAI

Best when you want:
- stronger analysis quality
- stronger structured outputs
- generally better reliability on large subjects

Requires:
- API key
- internet connectivity

### Ollama

Best when you want:
- lower-cost local testing
- local/private iteration

Requires:
- local Ollama server running
- a pulled local model

Example model for a mid-range GPU:
- `qwen3:8b`

Important:
- local models are often weaker than OpenAI for large or complex subject analysis
- if a request is too large, local analysis may be slower or less reliable

## Data and Persistence

StudyBud stores:
- imported PDFs
- extracted pages/chunks
- saved analysis
- saved chat history
- saved practice sets
- settings

The app supports a configurable data path from Settings.

## WSL Notes

StudyBud is Windows-first, but development often happens inside WSL.

That can affect:
- Electron external-link behavior
- native rebuilds
- Ollama access if Ollama runs on Windows and Electron runs in WSL

If something behaves strangely in WSL but not on Windows, treat that as a real possibility rather than assuming the app logic is wrong.

## Troubleshooting

### The app opens in a browser instead of as a desktop app

Use:

```bash
npm run dev
```

Do not open the renderer URL directly as if this were a normal web app.

### Native module errors involving `better-sqlite3`

Try:

```bash
npm run rebuild:native:electron
```

For Node-side test issues:

```bash
npm run rebuild:native:node
```

### Ollama is selected but analysis/chat fails

Check:
- Ollama is running
- the configured base URL is correct
- the model exists locally
- the model is not too weak for the current analysis size

### Imported PDF has little or no usable content

That usually means:
- the PDF is scanned/image-only
- extraction was limited
- AI features for that file will be incomplete until OCR exists

## Release / Demo Notes

Before demos or packaging, use:
- [release-readiness.md](./release-readiness.md)

For an abbreviated manual pass:
- run the checklist you keep for imports, analysis, chat, practice, and research together

## License

MIT
