# Homework Module Architecture Review (Sprint 1)

**Date:** 2024-02-18

## Attendees
- Product: Maya Levin
- Engineering: Or Peretz, Codex Agent
- Security: Daniel Green
- QA: Shir Peled

## Decisions
- Split module into `Runner` (student) and `Builder` (admin) domains under `app/homework` with shared services for fetching homework sets, submissions, and datasets.
- Adopt React Query for client state and optimistic updates; wrap module via `HomeworkQueryProvider` instead of adding global provider.
- Mock REST layer implemented in-app (`app/api/_mock`) until Node.js backend exposes `/homework`, `/datasets`, `/sql/execute`, and `/submissions` endpoints.
- Maintain 10 question limit enforced at UI layer; backend to validate as part of Mongo schema updates.
- Autosave cadence set to 1 second debounce to balance responsiveness and backend load expectations.

## Follow-ups
- Backend team to finalize Mongo schema for datasets + submissions and expose execution endpoint with throttling (owner: Daniel, due Sprint 3).
- QA to design dataset upload edge-case matrix once backend upload APIs land (owner: Shir).
- Security to review RBAC mapping and SQL sandbox logging prior to Sprint 4 launch (owner: Daniel).

## Notes
- Preview route currently mirrors mock data; once backend streaming is available, SSE integration will replace static preview.
- Practice mode remains unaffected; no shared dependencies altered.
- Sprint 3/4 extended the architecture with SQL execution, grading overrides, analytics logging, and unit/e2e coverage. Refer to `docs/homework-module/runner-grading-guide.md` for workflow details and updated endpoint surface.
