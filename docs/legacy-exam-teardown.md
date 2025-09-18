# Legacy Exam & Grade-by-Question Teardown (Sprint 0)

This document records the removal of the legacy Full Homework Exercise module (exam runner and admin grade-by-question) to prepare for a full rebuild.

Scope of removal:
- UI routes: `app/exam`, `app/admin/exam-grading`, `app/admin/grade-by-question`, `app/admin/cheat-detection`
- Components: `app/components/ExamInterface.tsx`, `app/components/ExamInterface.module.css`
- API routes: `app/api/exam`, `app/api/admin/exam`, `app/api/admin/exam-sessions`, `app/api/admin/grade`, `app/api/admin/grade-answer`, `app/api/admin/export-all-grading`, `app/api/admin/cheat-detection`
- Utilities: `app/utils/browserFingerprint.ts`, `app/utils/examSecurity.ts`, `app/utils/examMetricsTracker.ts`, `app/utils/trapDetector.ts`

Retained shared dependencies:
- Admin dashboard core: `app/admin/page.tsx`, `app/components/admin_page.tsx`, and unrelated admin API routes (e.g., `bulk-actions`, `users`).
- Practice/chat features and shared components/utilities not specific to exams.

Notes:
- No database migrations are performed here. Coordinate any MongoDB collection changes with the backend team in Sprint 1.
- Links to removed pages have been hidden from the Admin dashboard pending the rebuild.

