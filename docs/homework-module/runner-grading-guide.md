# Homework Runner & Grading Guide (Sprints 3–4)

This guide documents the student runner and instructor grading flows delivered during Sprints 3 and 4 of the Full Homework Exercise module rebuild.

## Prerequisites
- Install project dependencies (`npm install`).
- Start the local development server (`npm run dev`).
- Ensure mock API routes remain enabled (`app/api/_mock`).

## Student Runner Experience
1. Navigate to `/homework/runner/hw-set-analytics?studentId=student-demo` (replace `hw-set-analytics` and `student-demo` as needed).
2. Review assignment metadata (title, due date, overview) in the left sidebar.
3. Use the question navigator to switch between prompts. The autosave indicator reflects pending draft writes.
4. Compose SQL in the Monaco editor pane. Query executions:
   - Click **Run query** to call `/api/sql/execute`.
   - Result previews and rubric feedback stream into the feedback panel.
   - Attempt counts respect the configured `maxAttempts` per question.
5. Submit the assignment via **Submit homework**. Submission status and overall score update immediately.

### Runner Auto-save & Progress
- Draft answers post to `/api/submissions/:setId/save-draft` after 800 ms of inactivity.
- Progress bars derive from `/api/submissions/:setId/progress?studentId=…`.
- Analytics events `runner.execute_sql`, `runner.save_draft`, and `runner.submit` are recorded for compliance.

## Instructor Grading Workspace
1. Open `/homework/builder/hw-set-analytics/grade`.
2. The submission list displays status, score, and completion percent for each student.
3. Selecting a submission loads:
   - Per-question attempt history and earned points.
   - SQL response previews with instructor override controls.
4. Update question scores or notes and click **Save grading** to persist via `POST /api/submissions/by-id/:submissionId/grade`.
5. Publish final scores with **Publish grades**, calling `POST /api/homework/:setId/publish-grades`. This action emits `builder.publish_grades` analytics metadata (`updated`, `total`).
6. The activity log pulls from `/api/analytics/homework/:setId` to visualize runner and builder events chronologically.

## Mock Backend Enhancements
- `app/api/_mock/homeworkStore.ts` now supports:
  - Submission creation, auto-save, and execution history.
  - Question progress snapshots.
  - Instructor overrides and grade publication.
  - Analytics event aggregation for runner/builder actions.
- New API routes:
  - `/api/submissions/:setId` (runner + summaries for builder).
  - `/api/submissions/:setId/save-draft`, `/submit`, and `/progress`.
  - `/api/submissions/by-id/:submissionId`, `/progress`, `/grade`.
  - `/api/sql/execute`.
  - `/api/homework/:setId/publish-grades`.
  - `/api/analytics/homework/:setId`.

## Testing
- **Unit**: `npm test -- --runTestsByPath __tests__/homework/homeworkStore.test.ts` validates runner/grading store behaviours.
- **Playwright (E2E)**: `npx playwright test tests/e2e/homework-runner.spec.ts` and `tests/e2e/homework-grading.spec.ts` (requires dev server at `http://localhost:3000`).

## Usage Checklist
- [ ] Create/seed homework sets in builder.
- [ ] Verify runner auto-save and execution feedback.
- [ ] Review grading dashboard, adjusting scores as needed.
- [ ] Publish grades and confirm analytics timeline.
- [ ] Run unit + e2e tests prior to release.

Additional references:
- `docs/homework-module/admin-panel-hebrew-migration.md` – admin integration & Hebrew localisation checklist.

For architectural context, see `docs/homework-module/architecture-review.md`. Sprint-specific implementation notes live in `docs/homework-module/runner-grading-guide.md` (this file).
