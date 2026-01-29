# Tasks: "הכנה למבחן" homework set, show-answer UX, and analytics tracking

## Goal
Add a new homework exercise titled **"הכנה למבחן"** that uses its own database schema and questions, add a **"הצג תשובה"** (Show Answer) button on `/homework/runner/[id]`, and persist richer student interaction analytics (general analysis, show-answer clicks, time-to-show-answer per question, etc.).

---

## Sprint 1 — Data model + backend groundwork
### Homework set + dataset
- [x] Add a new seed/admin route (e.g. `/api/admin/seed-exam-prep`) to create:
  - [x] Dataset for "הכנה למבחן" with a *different* schema than "תרגיל 3".
    - Provide: `previewTables` with table/column names and a distinct `connectionUri`.
    - Provide: `description`, `scenario`, and `story`/`backgroundStory` explaining the schema.
  - [x] Homework set: title = **"הכנה למבחן"**, courseId, dueAt, overview, backgroundStory.
  - [x] Questions list with expectedResultSchema and per-question points/attempts.
  - [x] Update homework set `questionOrder` with the created question IDs.
- [ ] Add admin UI affordance (optional): a button in `/homework/questions` to seed "הכנה למבחן" like the existing “הוסף תרגיל 3” flow.

### Show-answer analytics storage
- [x] Extend analytics schema to include show-answer tracking fields.
  - Proposed fields in `QuestionAnalyticsModel.metrics`:
    - `showAnswerClicks: number`
    - `timeToFirstShowAnswer: number | null`
    - `showAnswerTimings: number[]` (ms deltas since question start)
- [x] Ensure `/api/analytics/question` payload accepts those fields.
- [x] If server-side validation is used elsewhere, update it to allow the new metrics.

Deliverables
- Seed route for the new homework set + dataset.
- Updated analytics model/schema for show-answer telemetry.

---

## Sprint 2 — Runner UX: Show-answer button
### UI/UX
- [x] Add **"הצג תשובה"** button to `/homework/runner/[id]`.
  - Recommend placing it near the Run button or in the results panel header.
- [x] On click, reveal the official answer/solution for the active question.
  - If the project treats `starterSql` as the reference solution, display it in a read-only code block.
  - If a separate solution field exists or is introduced, use that field instead.
- [x] Add copy-to-clipboard affordance (optional but helpful).
- [x] Ensure RTL layout and localized button text in Hebrew.

### Telemetry
- [x] Track every click on "הצג תשובה" per question.
  - [x] Increment `showAnswerClicks`.
  - [x] If first click, record `timeToFirstShowAnswer`.
  - [x] Append elapsed time (ms since question start) to `showAnswerTimings`.
- [x] Send analytics to `/api/analytics/question` on question switch and on unmount (existing pattern).

Deliverables
- Show-answer UX implemented.
- Analytics updated to capture show-answer interactions.

---

## Sprint 3 — General analysis & reporting
### What to store
- [x] Define “general analysis” payload for each question or submission.
  - Examples: hints used, confidence, summary, AI assistance usage (if relevant).
- [x] Decide whether this belongs in:
  - `QuestionAnalytics` (per-question metrics), or
  - `AnalysisResults` (submission-level summaries), or
  - New collection (if needed).

### Reporting endpoints
- [x] Extend existing analytics endpoints or add a new endpoint to query show-answer stats by:
  - homework set
  - question
  - student
  - time range
- [x] Provide a simple admin view (optional): show average show-answer time and click counts.

Deliverables
- [x] Analytics pipeline supports “general analysis”.
- [x] Read APIs for instructors/admins.

---

## Suggested schema for "הכנה למבחן"
> Replace with the final schema and questions you want to use.
- Tables (example only):
  - `Exams(ExamID, CourseCode, ExamDate, DurationMinutes, Room)`
  - `Students(StudentID, FirstName, LastName, Major, Year)`
  - `Registrations(StudentID, ExamID, RegisteredAt, Status)`
  - `Scores(StudentID, ExamID, Score, GradedAt)`

---

## Open questions / clarifications
- [ ] Confirm the exact tables + columns for "הכנה למבחן".
- [ ] Confirm if `starterSql` should be used as the **official answer** or if a new `solutionSql` field is required.
- [ ] Confirm which analytics should be included under “general analysis”.

---

## Definition of Done
- [ ] "הכנה למבחן" seed route creates dataset + homework set + questions, and is idempotent.
- [ ] Show-answer button displays the correct solution in the runner.
- [ ] Show-answer interactions are persisted to analytics.
- [ ] tasks.md updated with these implementation steps.
