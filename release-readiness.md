# StudyBud Release Readiness

## Purpose
This document is the Phase 7 release-hardening checklist for the current StudyBud MVP.

It is meant to be used before packaging, demoing, or handing the build to a real test user.

## MVP Scope
StudyBud currently supports:
- local subject/class workspaces
- lecture and homework PDF import
- AI division analysis
- grounded division chat
- selection-based clarification
- generated practice sets
- research search, browsing, and video suggestions

This MVP assumes:
- digital text PDFs are the primary supported input
- AI connectivity is required
- Windows is the primary release target
- OCR-first scanned-PDF support is not part of the MVP

## Release Checklist

### App Build
- Run `npm run typecheck`
- Run `npm run lint`
- Run `npm run package`
- Run `npm run make` on the target release platform when preparing an installer
- Confirm the packaged app launches without opening extra windows

### Windows Packaging
- Verify the Squirrel build is produced successfully on Windows
- Install the packaged app on a clean Windows test machine
- Launch the installed app from the Start menu
- Re-launch the app to confirm single-instance focus behavior still works
- Confirm the app data directory is created and writable
- Confirm uninstall removes the installed app cleanly

### First-Run Smoke Test
- Open the app and verify the Library, Workspace, and Settings navigation work
- Create a new subject
- Save AI settings for the intended provider
- If using Ollama, verify the configured base URL and model are reachable
- If using OpenAI, verify the API key is accepted
- If using Research APIs, verify Brave Search / YouTube keys save correctly

### Subject Workflow Smoke Test
- Import at least one lecture PDF
- Import at least one homework PDF
- Verify imported documents appear in the workspace
- Open a document and confirm the PDF viewer renders pages
- Confirm extracted page text is visible
- If a scanned/image-only PDF is imported, verify the limited/image-only warning appears

### Analysis Workflow Smoke Test
- Run `Analyze Subject`
- Verify analysis progress is visible while the request is running
- Verify divisions appear afterward
- Open multiple divisions and confirm the selection changes cleanly
- Click citations and verify they open the correct document/page
- If analysis leaves pages unassigned, verify the low-confidence warning is visible

### Chat Workflow Smoke Test
- Ask a normal division chat question
- Highlight summary text and ask a selection-based question
- Highlight extracted page text and ask a selection-based question
- Verify the answer appears in the right-side chat rail
- Expand grounding and verify citations render
- Confirm a failed chat request shows a retryable warning

### Practice Workflow Smoke Test
- Generate an easy practice set
- Generate a medium or hard practice set
- Reveal an answer key
- Hide the same answer key again
- Ask for an explanation of a question
- Ask for an explanation of an answer
- Delete a practice set
- Regenerate a practice set
- Confirm a failed generation shows a retryable warning

### Research Workflow Smoke Test
- Ask a chat question that returns suggested research queries
- Open the Research tab
- Run a suggested web query
- Open a website in the in-app browser
- Use Back, Forward, Reload, and Hide
- Open a website externally
- Open a suggested video externally
- Open a result that points to a PDF and verify the browser fallback behavior is clear
- Confirm a failed search shows a retryable warning

### Persistence / Reopen Smoke Test
- Close the app and reopen it
- Reopen an existing subject
- Confirm imported documents still load
- Confirm analysis is still present
- Confirm chat history is still present
- Confirm practice sets and revealed/hidden state persist correctly
- Confirm the custom data path still works if one was configured

## Known MVP Limitations
- OCR is not implemented
- Scanned/image-only PDFs may import successfully but still provide little or no usable extracted text
- AI quality depends on the configured provider and model
- Ollama local models can be noticeably weaker than OpenAI for large or complex subjects
- Research API integrations are optional; without keys, the app falls back to scraping-based search
- Research browsing behavior can still vary for sites that block embedding or require authentication
- Streaming AI output is not implemented yet
- The app is tested most heavily in local/dev environments and still needs stronger Windows installer validation

## Support Expectations
- If a document imports with `image-only` or `limited` extraction, warn the user that AI features may be incomplete for that file
- If a request fails, prefer retry guidance over silent failure
- If AI settings are invalid, direct the user to Settings instead of leaving the failure ambiguous
- If a website cannot be embedded, provide an external-open fallback
- If the environment is WSL-based, expect more edge cases around native rebuilds and external link opening

## Issue Triage Categories

### P0
- App does not launch
- Subject data is lost or corrupted
- Packaged build crashes on startup
- PDF import consistently fails for standard digital PDFs

### P1
- Analysis, chat, practice, or research is unusable for normal workflows
- Saved state does not persist across reopen
- External link opening is broken for the primary release platform
- Major layout breakage in the main workspace

### P2
- Retry states or warnings are missing/inconsistent
- Research/provider fallback behavior is confusing
- Specific PDFs have degraded extraction but the app still works overall
- Styling or readability issues in the workspace

### P3
- Copy tweaks
- minor spacing/polish issues
- non-blocking visual inconsistencies

## Suggested Test Course Packs
- one lecture-heavy STEM course
- one homework-heavy STEM course
- one mixed subject with both lecture and homework PDFs
- one scanned/image-only PDF to verify unsupported-document messaging

## Release Sign-Off
The build is ready for controlled MVP use when:
- build/lint/typecheck pass
- the packaged app launches successfully
- the smoke-test checklist above passes on the target platform
- known limitations are acceptable for the intended testers
