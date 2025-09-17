# Sprint 0 – Discovery & Teardown Summary

## Legacy Module Inventory
- **Server endpoints** – Removed handlers previously exposed under `/exam/*`, `/admin/exam/*`, `/admin/final-exam/*`, `/exam/check-*`, and `/api/admin/grade` that powered the legacy runner, auto-save, grading, and analytics sync flows.
- **Database utilities** – Eliminated helpers such as `createExamSession`, `saveExamAnswer`, `getExamForGrading`, `saveExamGrade`, and `updateAnswerGradeInFinalExams` along with ancillary comment-bank maintenance helpers that were tied to grade-by-question administration.
- **Support files** – Deleted the exam analytics module, Vercel export helpers (`local.js`, `metricsAnalytics.js`), sample assets (`finalExams_all.json.gz`, `מועד א.pdf`, `air_force_scenario.txt`), and multiple maintenance scripts (final exam exporters, grade validators, suspicious activity reports, etc.).
- **Front-end footprint** – No current Next.js routes or components referenced the deprecated exam flows, so no UI teardown was required beyond confirming the practice modal remained operational.

## Shared Dependencies to Retain
- **Practice experience** – `/practice` endpoints, `PracticeModal`, and the shared `questions` collection continue to serve the practice workflow without modification.
- **Chat and admin tools** – Feedback collection, chat session persistence, token balance controls, and admin search APIs were untouched because they serve unrelated product areas.
- **Data seeding** – Retained practice-focused scripts (`clear_practice.js`, `import_tergul_practice.js`, `extract_tergul_tables.js`) and fixtures required for ongoing tutoring exercises.

## Removal Actions
- Purged exam API routes from `mentor-server/api/index.js`, ensuring only practice-specific handlers remain.【F:mentor-server/api/index.js†L1-L214】
- Trimmed `mentor-server/api/db.js` to remove exam/session/grade helpers, leaving only shared exercise utilities exported.【F:mentor-server/api/db.js†L1-L318】
- Removed exam-only tests, utilities, and documentation references so the backend test suite now reflects the reduced surface area.【F:mentor-server/tests/helpers/testUtils.js†L1-L140】【F:mentor-server/TESTING.md†L1-L88】
- Deleted outdated analytics assets and maintenance scripts that operated on `examSessions`, `examAnswers`, `finalExams`, or `examGrades` collections.

## Database & Ops Notes
- The application no longer calls the legacy exam collections. Coordinate with the database team before dropping or migrating `examSessions`, `examAnswers`, `examGrades`, or `finalExams` data to avoid losing historical records needed for reporting.
- Practice endpoints still rely on the `questions`, `practiceTables`, and `practiceQueries` collections; ensure any future schema work preserves those documents.

## Next Steps for Sprint 1
- Define the runner and builder architecture, including fresh contracts for the forthcoming exam endpoints.
- Document required MongoDB migrations to introduce the new homework-set schema and decommission legacy collections safely.
- Outline security, RBAC, and telemetry requirements for the rebuilt experience before implementation begins.
