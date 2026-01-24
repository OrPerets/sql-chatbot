# Interactive Learning – Plan & Sprints

## 1. Overview

### 1.1 Purpose

Add an **Interactive Learning** page that students can access to:
- **Browse and view** lecture and practice PDFs (from `/docs/pdfs`)
- **Write and persist notes** per PDF or per topic
- **Get automated summaries** of their learning sessions with Michael (conversation summaries)
- **Summarize PDFs** with Michael (full summary or highlights)
- **Annotate PDFs in-place** (draw, highlight) with persistence
- **Explore content by topic** (mapped to SQL curriculum weeks/concepts)
- Use a **professional, elegant UI/UX** aligned with the `/visualizer` route

### 1.2 Goals

- Central place for all course materials (lectures + practices) with clear structure
- Seamless link to Michael for Q&A and for generating/refining summaries
- Topic-based navigation using `SQL_CURRICULUM_MAP` (weeks 1–13) for discoverability
- Notes that persist per student and are attachable to a PDF or topic
- Automated summaries (from existing conversation-summary system) surfaced in-context with Michael

### 1.3 Non-Goals (Initial)

- Real-time collaboration or shared notes
- Video lectures or other non-PDF media
- Offline/PWA-specific optimizations for PDFs beyond normal caching

### 1.4 Access / Entry Point

**Users reach the Interactive Learning page from the landing hub:**

- When a user is on **`/landing`** and clicks the **"למידה אינטראקטיבית"** button (or card), they must be navigated to **`/interactive-learning`**.
- Implementation: in `app/landing/page.tsx`, the card/button labeled **"למידה אינטראקטיבית"** must call `router.push('/interactive-learning')` (or equivalent) on click. Replace or repurpose the existing disabled "סביבת למידה אינטראקטיבית" / "יגיע בהמשך" card so it is active and uses the label **"למידה אינטראקטיבית"** (or keep "סביבת למידה אינטראקטיבית" as the card title with "למידה אינטראקטיבית" as the primary action label—product decision). The critical requirement: **clicking that entry on `/landing` opens the Interactive Learning page at `/interactive-learning`**.

---

## 2. Content Inventory

### 2.1 PDFs in `/docs/pdfs`

| File | Type | Suggested mapping |
|------|------|-------------------|
| `lecture01.pdf` … `lecture14.pdf` | Lecture | Week 1 … 14 (lecture14 can map to week 13+ or “review”) |
| `tergul01.pdf` … `tergul11.pdf` | Practice (תרגול) | Week 1 … 11 |
| `tergul05B.pdf`, `tergul06B.pdf` | Practice (variants) | Week 5, 6 alternates |

**Total:** 14 lectures + 13 practices (including B variants) = **27 PDF files**.

### 2.2 Topic Mapping (from `lib/sql-curriculum.ts`)

Use `SQL_CURRICULUM_MAP` and `getAllowedConceptsForWeek(week)` to:
- Map each **week** to: `lecture0N`, `tergul0N` (and B variants when present)
- Display **concepts** per week in the topic view (e.g. “CREATE TABLE, DDL”, “SELECT”, “JOIN”, etc.)

Example mapping for UI:

| Week | Concepts (from curriculum) | Lectures | Practices |
|------|----------------------------|----------|-----------|
| 1 | CREATE TABLE, DDL | lecture01 | tergul01 |
| 2 | SELECT, constraints | lecture02 | tergul02 |
| 3 | FROM, WHERE, BETWEEN, LIKE | lecture03 | tergul03 |
| … | … | … | … |
| 7 | JOIN, ON, INNER/LEFT/RIGHT | lecture07 | tergul07 |
| … | … | … | … |
| 13 | TRIGGER, virtual tables | lecture13 | tergul11 (or extend) |

---

## 3. UI/UX Reference: Visualizer

The Interactive Learning page should match the **visual and interaction patterns** of `/visualizer`:

### 3.1 Layout

- **Sticky header** (e.g. `compactHeader`): dark blue (`#1e3a8a`), white title, optional feature badge, RTL-aware
- **Main layout**: CSS Grid, e.g. `grid-template-columns: 280px 1fr` (sidebar + main)
- **Sidebar (~280px)**: navigation, filters, list of PDFs or topics, and/or list of “My summaries”
- **Main area**: PDF viewer + notes panel, or topic detail + PDF list + summaries

### 3.2 Visual Language (from `visualizer.module.css`)

- **Backgrounds**: `#f8fafc` (page), `#f1f5f9` (sidebar), `#ffffff` (cards, banners)
- **Borders**: `#e2e8f0`, `1px`
- **Shadows**: `0 4px 12px rgba(15, 23, 42, 0.06)`, `0 3px 12px rgba(15, 23, 42, 0.18)` for header
- **Radius**: `12px` cards/panels, `8px` inputs
- **Accent**: `#1e3a8a` (primary), focus ring `0 0 0 3px rgba(30, 58, 138, 0.12)`
- **Typography**: system font stack, `direction: rtl` where needed, clear hierarchy (title, subtitle, body)

### 3.3 Patterns to Reuse

- **Module CSS** per route: `interactive-learning.module.css`
- **ARIA**: `aria-label`, `aria-live`, `role="alert"` for errors; `aria-expanded` for collapsibles
- **Keyboard**: Escape to close modals; shortcuts for frequent actions
- **Scrollbars**: Custom `-webkit-scrollbar` for main and sidebar
- **Responsive**: Single column and stacked blocks below ~1024px (similar to `stepBannerContent` breakpoint)

---

## 4. Technical Notes

### 4.1 PDF Serving

- **Option A (recommended for speed):** Copy or symlink `docs/pdfs/*` into `public/learning/pdfs/` and serve as `/learning/pdfs/lecture01.pdf`. Use `next.config` or build script if needed.
- **Option B:** API route `/api/learning/pdfs/[filename]/route.ts` that:
  - Reads from `docs/pdfs/` or a configured path
  - Checks auth (student role) and returns `Content-Type: application/pdf` with appropriate `Content-Disposition` (inline for viewer, attachment for download).
- **Filename handling:** `lecture10 [war].pdf` → encode as `lecture10%20%5Bwar%5D.pdf` in links; consider a slug map (e.g. `lecture10-war`) for cleaner URLs.

### 4.2 Notes Persistence

- **DB:** New collection, e.g. `COLLECTIONS.STUDENT_NOTES` or `student_notes`.
- **Schema (draft):**
  - `userId: string`
  - `targetType: 'pdf' | 'topic'`
  - `targetId: string` (e.g. `lecture03`, `week-5`, or `tergul07`)
  - `content: string` (Markdown or plain text)
  - `createdAt`, `updatedAt`
- **API:** `GET/PUT /api/learning/notes` with `?userId= &targetType= &targetId= ` or a dedicated `/api/learning/notes/[targetType]/[targetId]` for a single note.

### 4.3 Michael & Summaries

- **Michael:** Use existing Assistants API and chat/threads; from Interactive Learning, open the main chat or an embedded “Ask Michael”  with context (e.g. “I’m viewing lecture 5 / week 5”).
- **Summaries:** 
  - `GET /api/conversation-summary/student/[userId]?limit=20&insights=true` → `summaries` and `insights`.
  - Show in a “My summaries with Michael” or “Learning insights” block in the sidebar or a tab in the main area; optional “Generate summary” that calls the existing analyze flow if not yet run.

### 4.4 Auth & Access

- Reuse existing auth (e.g. `currentUser` in `localStorage`, or session/cookie). Restrict `/interactive-learning` (and PDF/notes APIs) to logged-in students (or roles that include students).
- Optional: feature flag `NEXT_PUBLIC_INTERACTIVE_LEARNING=1` (similar to `NEXT_PUBLIC_QUERY_VISUALIZER`) to return 404 when disabled.

---

## 5. Sprints & Task Lists

---

### Sprint 1: Foundations & Routing

**Objective:** Route, layout, and PDF serving in place; minimal shell that lists and opens PDFs.

#### Todo

- [x] **1.1** Add route `app/interactive-learning/page.tsx` and, if used, `layout.tsx` (or inherit root layout). Guard with `NEXT_PUBLIC_INTERACTIVE_LEARNING=1`; `notFound()` when disabled.
- [x] **1.2** Create `app/interactive-learning/interactive-learning.module.css` with base layout: `compactHeader`, main grid (sidebar + main), RTL, and color/radius variables aligned with visualizer.
- [x] **1.3** Implement PDF asset strategy:
  - [x] **1.3b** Create `app/api/learning/pdfs/[filename]/route.ts` to serve from `docs/pdfs` with auth and `Content-Type: application/pdf`.
- [x] **1.4** Add a static manifest or config (e.g. `lib/learning-content.ts` or JSON) listing all PDFs with: `id`, `filename`, `type` (lecture|practice), `week`, `label` (e.g. “הרצאה 3”, “תרגול 5”). Include `lecture10 [war].pdf` and `tergul05B`, `tergul06B`.
- [x] **1.5** Build `InteractiveLearningRoot` (or similar) client component: header “למידה אינטראקטיבית”, sidebar with two lists: “הרצאות” and “תרגולים”, main area that shows a placeholder or an iframe/embed for the selected PDF. Use the manifest to build the lists and PDF URL (public path or `/api/learning/pdfs/…`).
- [x] **1.6** Wire navigation from `/landing`: ensure the **"למידה אינטראקטיבית"** button/card navigates to `/interactive-learning` on click. In `app/landing/page.tsx`, replace or repurpose the current disabled “סביבת למידה אינטראקטיבית” / “יגיע בהמשך” card so it is active, uses the label “למידה אינטראקטיבית” (per §1.4), and calls `router.push('/interactive-learning')`.

**Deliverables**

- `/interactive-learning` route with header, sidebar (lectures + practices), and PDF viewer area.
- On `/landing`, the **"למידה אינטראקטיבית"** button/card navigates to `/interactive-learning` (§1.4).
- PDFs viewable (and optionally downloadable) from the app.
- Content manifest used for listing.

**Implementation Notes**

- `/interactive-learning` is guarded by `NEXT_PUBLIC_INTERACTIVE_LEARNING=1` and renders the new shell UI with a sidebar and PDF viewer in an iframe.
- PDFs are served via `app/api/learning/pdfs/[filename]` from `docs/pdfs` using an allowlist sourced from `lib/learning-content.ts`.
- The landing card now routes to `/interactive-learning` and uses the updated copy.
- `lecture10 [war].pdf` was not present in `docs/pdfs`, so the manifest currently references `lecture10.pdf` only.

---

### Sprint 2: Topic-Based View & Curriculum Mapping

**Objective:** Navigate by topic (week + concepts); filter and open PDFs by week.

#### Todo

- [x] **2.1** In `lib/learning-content.ts` (or equivalent), map each PDF to `week` using `SQL_CURRICULUM_MAP` and, where useful, `getAllowedConceptsForWeek(week)`. Add `concepts: string[]` for display.
- [x] **2.2** Add a “לפי נושא” (by topic) mode in the sidebar: list of weeks 1–13 (and 14 if desired) with concepts per week. Clicking a week shows only PDFs for that week in the main area or in a sub-list.
- [x] **2.3** Topic card (or row): week number, `concepts` as tags or short list, and links to `lecture0N` and `tergul0N` (and B variants). Reuse visualizer-like card styles (white bg, border, radius, light shadow).
- [x] **2.4** Persist “view mode” in `localStorage` (e.g. `interactive-learning-view: 'list' | 'topic'`) so returning users keep their choice.
- [ ] **2.5** (Optional) “השבוע הנוכחי” link that uses `getCurrentWeekContextNormalized` or `/api/mcp-michael/current-week` to highlight and scroll to the current week’s topic.

**Deliverables**

- Sidebar: “לפי רשימה” (list) and “לפי נושא” (topic) with week-based browsing and concept tags.
- PDFs openable from the topic view; view-mode preference persisted.

**Implementation Notes**

- Added `concepts` to each learning asset using `SQL_CURRICULUM_MAP` (with `getAllowedConceptsForWeek` fallback) and reused this mapping for topic tags.
- Introduced a view toggle with `interactive-learning-view` persisted in `localStorage`, defaulting to list view.
- Topic mode now lists weeks in the sidebar and surfaces a week card with concept tags plus quick links to that week’s lectures/תרגולים.

---

### Sprint 3: Notes (Write, Edit, Persist)

**Objective:** Students can add and edit notes per PDF or per topic; notes persist in DB.

#### Todo

- [x] **3.1** Add `COLLECTIONS.STUDENT_NOTES` and a schema in `lib/database.ts` (or a `lib/learning-notes.ts`). Implement `getNote(userId, targetType, targetId)` and `upsertNote(userId, targetType, targetId, content)`.
- [x] **3.2** Create `GET /api/learning/notes` (query: `userId`, `targetType`, `targetId`) and `PUT /api/learning/notes` (body: same + `content`). Auth: require `userId` to match the authenticated user (or server-side session).
- [x] **3.3** In the main area, add a **notes panel** (collapsible or always visible): “הערות” with a textarea or simple rich editor. `targetType=pdf`, `targetId=lecture03` (or the chosen PDF id from the manifest). Load on PDF select; save on blur or explicit “שמור” (and/or debounced on change).
- [x] **3.4** For “לפי נושא” view: when a week is selected, allow `targetType=topic`, `targetId=week-5`. One note per week; same UI pattern as PDF notes.
- [x] **3.5** Indicate save state: “נשמר”, “שומר…” or “שגיאה” with `aria-live` for accessibility.
- [ ] **3.6** (Optional) Basic Markdown in notes (e.g. `**bold**`, `-` list) and a minimal preview toggle; otherwise treat as plain text with `\n` for newlines.

**Deliverables**

- Notes per PDF and per topic (week), stored in MongoDB and editable in the UI.
- Save feedback and basic accessibility.

**Implementation Notes**

- Added `student_notes` collection plus `getLearningNote`/`upsertLearningNote` helpers, with upserted timestamps.
- Introduced `/api/learning/notes` GET/PUT for loading and saving notes per PDF or week.
- Added an always-visible notes panel with “שמור” and live status feedback that swaps between PDF and topic targets.

---

### Sprint 4: Michael Integration & Automated Summaries

**Objective:** Link to Michael from the page and surface conversation summaries (and optional “generate summary”) in the UI.

#### Todo

- [x] **4.1** In the header or sidebar, add “שאל את מייקל” or “לפתוח עם מייקל” that:
  - Navigates to `/entities/basic-chat` (or the main chat route) with optional query or context, e.g. `?context=interactive&source=lecture05`; **or**
  - Opens an embedded chat drawer/panel (if a reusable chat component can be embedded) with the same assistant and a system hint like “The student is viewing Interactive Learning, lecture 5”.
- [x] **4.2** Fetch summaries: in `InteractiveLearningRoot`, call `GET /api/conversation-summary/student/[userId]?limit=10&insights=true`. Parse `data.summaries` and `data.insights`.
- [x] **4.3** Add a “סיכומי שיחות עם מייקל” (or “תובנות למידה”) block in the sidebar or a tab in the main area. For each summary: `sessionTitle`, `summaryPoints` (bullets), `keyTopics` (tags), and `createdAt`. Reuse card/panel styles from the visualizer.
- [ ] **4.4** (Optional) “צור סיכום” for a given thread/session: call `POST /api/conversation-summary/analyze` (or the existing analyze endpoint) with `sessionId` and messages; then refetch and append to the list. If the analyze API does not support on-demand for arbitrary threads, document the gap and add a stub/“בקרוב” for a later sprint.
- [x] **4.5** If `data.insights` exists, show a compact “תובנות” card: e.g. `challengeAreas`, `recommendedActions`, or a short AI insight string. Style consistently with the rest of the page.

**Deliverables**

- One-click (or one-tap) access to Michael with optional context (e.g. current PDF/week).
- “סיכומי שיחות עם מייקל” (and insights if available) visible in the Interactive Learning page.

**Implementation Notes**

- Added a “שאל את מייקל” action in the sidebar that links to `/entities/basic-chat` with context query params for the selected PDF and week.
- Integrated summaries fetch from `/api/conversation-summary/student/[userId]?limit=10&insights=true` and rendered summary cards with bullets, topic tags, and created date.
- Added a compact insights card in the sidebar showing totals, trends, engagement, top topics, and challenges when data is available.

---

### Sprint 5: UI/UX Polish & Responsiveness

**Objective:** Match visualizer-level quality: responsive layout, loading/error states, and small interactions.

#### Todo

- [x] **5.1** **Loading:** Skeleton or spinner for: (a) initial page and sidebar, (b) PDF in iframe/embed, (c) notes fetch/save, (d) summaries fetch. Use `aria-busy` and `aria-live` where appropriate.
- [x] **5.2** **Errors:** If PDF fails to load (404, 403, or CORS): show a clear message and a “הורד קובץ” fallback linking to the PDF URL (or download endpoint). For notes/summaries, toast or inline `role="alert"` with retry.
- [x] **5.3** **Responsive:** For viewport &lt; 1024px: collapse sidebar into a top/bottom bar or drawer; main area full width. PDF viewer and notes stack vertically. Touch-friendly tap targets (min 44px) for list items and buttons.
- [x] **5.4** **Micro-interactions:** Hover states on cards and list rows; focus-visible rings (e.g. `0 0 0 3px rgba(30, 58, 138, 0.12)`). Optional: short fade-in for the PDF area when switching documents.
- [x] **5.5** **RTL and i18n:** Ensure “הרצאה”, “תרגול”, “הערות”, “סיכומי שיחות”, and any new strings are in the correct place for RTL; support `dir` and `lang` from root layout. If an i18n layer exists, add keys for interactive-learning.
- [x] **5.6** **PDF viewer UX:** If using iframe: add a “פתח בחלון חדש” and “הורד” so students can use the browser’s native PDF or download. If using an embedded PDF viewer (e.g. `react-pdf` or similar), ensure zoom and page navigation are usable on mobile.

**Deliverables**

- Reliable loading and error handling; responsive layout; RTL-friendly and accessible.
- Refinements so the page feels as polished as `/visualizer`.

**Implementation Notes**

- Added loading indicators for summaries, notes, and the PDF viewer with `aria-busy`/`aria-live` plus skeleton cards and a spinner overlay.
- Introduced PDF error handling that surfaces a clear message with open/download fallbacks, and retry buttons for notes/summaries errors.
- Ensured touch-friendly hit targets (min 44px) and added a subtle PDF fade-in alongside existing hover/focus micro-interactions.

---

### Sprint 6: Extras & Hardening

**Objective:** Edge cases, performance, and any remaining items before release.

#### Todo

- [x] **6.1** **URL state:** Reflect selected PDF (and optionally view mode and topic) in the query string, e.g. `?pdf=lecture03&view=topic&week=3`. On load, parse and set initial selection so links and refresh work.
- [x] **6.2** **Notes export (optional):** “ייצא הערות” that fetches all notes for the user and returns a JSON or Markdown file (or a simple HTML print view) for backup.
- [x] **6.3** **Performance:** Lazy-load or dynamically import a heavy PDF viewer lib if used; virtualize long lists (e.g. 50+ summaries) if needed. Ensure the notes API and summaries API do not run on every keystroke; debounce and batch where appropriate.
- [x] **6.4** **Security:** Ensure PDF API (if used) only serves files from an allowlist (manifest); no path traversal. Notes and summaries APIs must always filter by authenticated `userId`.
- [x] **6.5** **Tests:** At least one smoke test (e.g. Playwright or React Testing Library) that: opens `/interactive-learning`, selects a PDF, and checks that the viewer area updates (or that the PDF link is present). Optional: API tests for `GET/PUT /api/learning/notes` with a test user.
- [x] **6.6** **Docs:** Update `README` or `docs/` with: how to enable `NEXT_PUBLIC_INTERACTIVE_LEARNING`, where PDFs live (`public/learning/pdfs` or `docs/pdfs` + API), and how to add a new PDF (edit manifest and, if needed, `docs/pdfs`).

**Deliverables**

- Shareable URLs, optional notes export, security checks, at least one e2e/smoke test, and short documentation.

**Implementation Notes**

- URL state is now synchronized with `pdf`, `view`, and `week` query params, with initial hydration reading from the URL before falling back to local storage.
- Added a notes export endpoint and UI action that downloads a JSON snapshot of the learner’s notes.
- Conversation summaries and notes APIs now validate the requesting user via `x-user-id` to reduce cross-user access.
- Added a Playwright smoke test and updated the test server command to ensure the feature flag is enabled during e2e runs.
- Documented the Interactive Learning feature flag and PDF/notes export details in `README.md`.

---

### Sprint 7: PDF Summaries with Michael (Full + Highlights)

**Objective:** Let students ask Michael to summarize a selected PDF, choosing between a full summary and a concise highlight list.

#### Todo

- [x] **7.1** Add a **“סיכום עם מייקל”** action near the PDF viewer with two options:
  - **“סיכום מלא”** (full summary)
  - **“Highlights”** (main bullets from the file)
  Persist the last choice in `localStorage` (e.g. `interactive-learning-summary-mode`).
- [x] **7.2** Introduce an API endpoint (e.g. `POST /api/learning/summarize`) that accepts:
  - `userId`, `pdfId`, `summaryMode: 'full' | 'highlights'`
  - Optionally `pageRange` for partial summarization
  The endpoint should load the PDF (from `docs/pdfs` or `public/learning/pdfs`) and send it to Michael’s summarization flow (Assistants API or existing summarize pipeline).
- [x] **7.3** Add a **summary output panel** below the viewer:
  - Render returned summary text (Markdown OK)
  - Provide “העתק”, “שמור להערות”, and “שאל את מייקל על הסיכום”
  - Store the latest summary per PDF + mode in `student_notes` or a new collection (e.g. `learning_summaries`).
- [x] **7.4** Add UI states: loading spinner, error display with retry, and `aria-live` updates.
- [x] **7.5** Update `interactive.md` acceptance criteria + docs to include the new summary flow (and mention PDF size limits if any).

**Deliverables**

- Two summary options (full or highlights) with a visible summary panel.
- Summaries are persisted and can be referenced from notes or Michael chat.

**Implementation Notes**

- Added a summary toolbar with “סיכום מלא”/“Highlights” options persisted in `interactive-learning-summary-mode`, plus a summary panel with copy/save-to-notes and Michael follow-up actions.
- Implemented `POST /api/learning/summarize` with PDF text extraction and storage in a new `learning_summaries` collection, and added `GET /api/learning/summaries` for loading cached summaries.
- Summaries are capped to the first 12k characters of extracted text for performance; the UI discloses when truncation is applied and provides loading/error states.

---

### Sprint 8: Micro-Quizzes Foundations (Model, Generation, Embedding)

**Objective:** Define quiz data, generate quizzes with Michael, and embed 3–5 question checks per lecture/practice with immediate feedback and hints.

#### Todo

- [x] **8.1** **Quiz model & storage:** Add a `learning_quizzes` collection to store quiz definitions and a `learning_quiz_results` collection for per-user attempts.
  - **Quiz definition fields:** `quizId`, `targetType: 'lecture' | 'practice'`, `targetId` (e.g. `lecture03` or `tergul07`), `title`, `createdBy: 'michael'`, `questions[]`.
  - **Question formats:** 
    - **MCQ:** `type: 'mcq'`, `prompt`, `choices[]`, `correctIndex`, `hint`, `explanation`.
    - **SQL runner:** `type: 'sql'`, `prompt`, `starterSql?`, `expectedResult?` (or validation rules), `hint`, `explanation`.
  - **Result fields:** `userId`, `quizId`, `attemptId`, `startedAt`, `completedAt`, `score`, `answers[]`, `feedbackByQuestion[]`.
- [x] **8.2** **Quiz generation by Michael:** Add `POST /api/learning/quizzes/generate` that asks Michael to create a 3–5 question quiz for a given `targetId` (lecture/practice). Persist the quiz as `createdBy: 'michael'`.
- [x] **8.3** **Quiz retrieval & caching:** Add `GET /api/learning/quizzes?targetType=&targetId=` to fetch the latest quiz; if none exists, show “צור חידון עם מייקל” and generate on demand.
- [x] **8.4** **UI embed per lecture/practice:** In the Interactive Learning page, add a “מיקרו-חידון” panel below the PDF viewer (or in a tab) that:
  - Shows 3–5 questions with **immediate feedback** after each submission.
  - Reveals **hints** on request and provides an explanation after answering.
  - Displays a mini progress indicator (e.g. `2/5`).
- [x] **8.5** **SQL runner integration:** For `type: 'sql'` questions, reuse the existing infrastructure at `/homework/runner/[id]`:
  - Submit the SQL to the runner and compare against `expectedResult` or validation rules.
  - Show run output, correctness, and hints without leaving the quiz context.
- [x] **8.6** **Result capture API:** Add `POST /api/learning/quizzes/attempts` to persist per-user attempts (`answers[]`, `score`, `feedbackByQuestion[]`), and return attempt metadata for UI use.
- [x] **8.7** **Accessibility & i18n:** Ensure RTL layout, keyboard navigation, and `aria-live` feedback for correct/incorrect states; add localized labels for quiz actions.

**Deliverables**

- 3–5 question micro-quiz embedded per lecture/practice with instant feedback and hints.
- Michael-generated quizzes (MCQ + SQL runner) stored per PDF and reusable for multiple students.
- Per-user quiz results stored for future adaptive learning (capture API in place; UI surfaced in Sprint 9).

**Implementation Notes**

- Each lecture/practice can have one canonical quiz generated by Michael, with per-user attempts stored separately.
- SQL questions accept expected SQL for instant checks, and can optionally deep-link into `/homework/runner/[id]` when runner metadata is available.
- The UI embeds a micro-quiz panel with hint toggles, per-question feedback, and a completion button that persists attempts.

---

### Sprint 9: Quiz Progress Tracking & Learning Dashboard

**Objective:** Provide a dedicated progress view under `/interactive-learning` so students can track quiz completion, scores, and improvement over time.

#### Todo

- [x] **9.1** **Progress page:** Add a new route at `/interactive-learning/progress` (or a tab within the Interactive Learning layout) with a dashboard-style view of quiz progress.
- [x] **9.2** **Progress cards:** Show per-lecture/practice status: last score, best score, attempt count, and last attempt date.
- [x] **9.3** **Recent activity:** List the most recent quiz attempts with timestamps and quick links back to the relevant lecture/practice.
- [x] **9.4** **Completion tracking:** Display overall completion % (e.g., “10/27 quizzes attempted”) and an at-a-glance progress bar.
- [x] **9.5** **Adaptive signals:** Surface basic insights (e.g., “Topics to revisit”) using stored per-question outcomes and time-to-answer.
- [x] **9.6** **Navigation:** Add a clear entry point from `/interactive-learning` to the progress page (sidebar link or header action).
- [x] **9.7** **Accessibility & i18n:** RTL layout, keyboard navigation, and `aria-live` updates for progress metrics.

**Deliverables**

- A progress tracking page in `/interactive-learning` that aggregates quiz results per student.
- Clear visibility into quiz completion, recent attempts, and improvement trends.

**Implementation Notes**

- Added `/interactive-learning/progress` with summary cards, progress cards, recent activity, and topics-to-revisit insights in an RTL dashboard layout.
- Introduced `/api/learning/quizzes/progress` to aggregate `learning_quiz_results` with quiz metadata and compute completion stats plus adaptive signals.
- Linked the progress dashboard from the Interactive Learning sidebar for quick navigation back and forth.
