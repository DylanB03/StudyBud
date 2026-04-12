# StudyBud Demo Smoke Checklist

Use this before a live demo, handoff, or short test session.

## 1. Launch
- Open StudyBud from the packaged app or `npm run dev`
- Confirm only one app window opens
- Confirm the Library view renders without errors

## 2. Settings
- Open `Settings`
- Confirm the intended AI provider is configured
- If using Ollama, confirm the model/base URL look correct
- If using OpenAI, confirm the key is configured
- If using Research APIs, confirm Brave/YouTube settings look correct

## 3. Subject Setup
- Create a fresh subject
- Import at least one lecture PDF
- Import at least one homework PDF
- Confirm both documents appear in the workspace

## 4. Document Confidence
- Open each imported document
- Confirm extracted page text appears for normal PDFs
- If a scanned/image-only PDF is used, confirm the limited/image-only warning is visible

## 5. Analysis
- Run `Analyze Subject`
- Confirm the progress banner appears
- Confirm divisions appear after completion
- Open at least two divisions
- Click a citation and confirm it jumps to the correct document/page

## 6. Chat
- Ask one normal division question
- Highlight analysis text and ask a follow-up question
- Expand `Grounding` on an assistant answer
- Confirm citations render and can be opened

## 7. Practice
- Generate one practice set
- Reveal an answer key
- Hide the answer key again
- Ask for an explanation of either the question or answer

## 8. Research
- Open the `Research` tab
- Run a suggested or manual web query
- Open one site inside the in-app browser
- Open one website externally
- Open one video suggestion externally

## 9. Reopen
- Close the app
- Reopen it
- Confirm the same subject, analysis, chat, and practice data are still available

## 10. Final Demo Check
- No overlapping layout issues
- No unexplained blank states
- No stuck loading indicators
- No console-blocking runtime errors during the main happy path
