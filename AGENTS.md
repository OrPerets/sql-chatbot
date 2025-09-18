# Full Homework Exercise Module Rebuild Guidelines (Exam & Grade-by-Question Pages)

This document outlines the phased implementation plan for rebuilding the Full Homework Exercise module in Michael, focusing on the exam page and all admin pages related to grade-by-question.

⚠️ Important: The practice option available through the Michael chat button must remain untouched and fully operational. This rebuild affects only the exam-related and grading-related flows.

The existing exam/grade-by-question implementation must be fully removed before introducing the new solution. Follow the sprint structure below to deliver the new student (runner) and instructor/admin (builder) experiences while maintaining integration with the Node.js + MongoDB backend services.


---

## Sprint 0 — Discovery & Teardown

**Goal**: Understand current shortcomings and prepare the codebase for a complete rebuild of the exam and grade-by-question flows.

**Deliverables:**

Documented assessment of the legacy exam and admin grading components slated for removal.

Clean codebase without obsolete "Full Homework Exercise" exam-related files, routes, database schemas, or UI remnants.

Michael’s practice option remains intact and unaffected.


**Task Board:**

[ x ] Inventory existing student exam runner, admin grade-by-question components, utilities, API endpoints, and fixtures.

[ x ] Identify shared dependencies (datasets, auth hooks, telemetry) that must be retained.

[ x ] Delete all exam-specific legacy module source, tests, styles, and configuration entries.

[ x ] Remove or migrate deprecated database collections or schemas related to grading (coordinate with backend team for MongoDB updates).

[ x ] Confirm CI/test suite passes after removal and update documentation to mark the module as pending rebuild.

### Sprint 0 Output Notes
- The legacy Full Homework Exercise module (exam runner and admin grade-by-question) has been removed in preparation for a full rebuild.
- Practice mode via Michael’s chat remains fully operational and unaffected.
- See `docs/legacy-exam-teardown.md` for inventory and scope. New Runner/Builder architecture will be introduced in subsequent sprints.

## Sprint 1 — Architecture & Foundations
**Goal:** Establish the technical blueprint and baseline infrastructure for the new module.

**Deliverables:**
- Approved architecture diagram covering front-end components, API contracts, and data flow with Node.js + MongoDB services.
- Interface definitions for both Runner (student) and Builder (admin) modules, including routing and navigation updates.
- Security and compliance checklist covering auth, RBAC, and data handling.

**Task Board:**
- [ x ] Design the high-level component hierarchy (pages, layouts, editors, services) for student and admin experiences.
- [ x ] Define shared domain models (HomeworkSet, Question, Submission, Feedback, Dataset) and TypeScript interfaces.
- [ x ] Draft REST/GraphQL API specs for CRUD operations, execution requests, grading feedback, and dataset management.
- [ x ] Document integration points for the online SQL editor/executor, ensuring sandboxing and rate-limits.
- [ x ] Produce security requirements: authentication guardrails, authorization matrix, audit logging, and data retention policies.
- [ x ] Outline acceptance criteria for the entire module (see section below) and obtain stakeholder sign-off.

### Sprint 1 Architecture Blueprint
- **Runner domain**: `app/homework/[setId]/runner/layout.tsx` orchestrates shell layout with instruction sidebar, question navigator, and SQL workspace region. Child route `page.tsx` renders per-question view composed of `QuestionContextProvider`, `QuestionPromptPanel`, `SqlEditorPane`, and `ExecutionFeedbackPanel`.
- **Builder domain**: `app/homework/builder/layout.tsx` gates access behind RBAC middleware and nests routes for dashboard (`page.tsx`), `create` wizard steps (metadata, dataset, questions, rubric, publish), and `preview/[setId]`. Shared UI primitives (panels, forms, data grids) live under `app/homework/common`.
- **Shared services**: `app/homework/services` exposes hooks built atop React Query for homework sets, questions, submissions, datasets, and execution requests. Client-side schemas validated with Zod to enforce payload contract parity with backend DTOs.
- **State flow**: optimistic updates on create/update actions with invalidation of `homeworkSets`, `questionsBySet`, and `submissionByUser` caches. Auto-save drafts use debounce + background mutation workers.

### Component Hierarchy Snapshot
```
Runner
|-- RunnerLayout
|   |-- InstructionsPanel
|   |-- QuestionNavigator
|   `-- QuestionWorkspace
|       |-- PromptView
|       |-- SqlEditor (monaco-based)
|       `-- FeedbackTabs (Results | Rubric | Comments)

Builder
|-- BuilderLayout
|   |-- DashboardSummary
|   |-- HomeworkWizard
|   |   |-- MetadataStep
|   |   |-- DatasetStep
|   |   |-- QuestionsStep (QuestionCard x10)
|   |   |-- RubricStep
|   |   `-- PublishStep
|   `-- PreviewModal
```

### Shared Domain Models (TypeScript)
```ts
export interface Dataset {
  id: string;
  name: string;
  description?: string;
  connectionUri: string;
  previewTables: Array<{ name: string; columns: string[]; }>; // surfaced in builder + runner context
  tags: string[];
  updatedAt: string;
}

export interface Question {
  id: string;
  prompt: string;
  instructions: string;
  starterSql?: string;
  expectedResultSchema: Array<{ column: string; type: string; }>;
  gradingRubric: RubricCriterion[];
  datasetId: string;
  maxAttempts: number;
  points: number;
}

export interface RubricCriterion {
  id: string;
  label: string;
  description: string;
  weight: number; // percentage of question score
  autoGraded: boolean;
}

export interface HomeworkSet {
  id: string;
  title: string;
  courseId: string;
  dueAt: string;
  published: boolean;
  datasetPolicy: 'shared' | 'custom';
  questionOrder: string[]; // 10 entries
  visibility: 'draft' | 'published' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Submission {
  id: string;
  homeworkSetId: string;
  studentId: string;
  attemptNumber: number;
  answers: Record<string, SqlAnswer>; // keyed by questionId
  overallScore: number;
  status: 'in_progress' | 'submitted' | 'graded';
  submittedAt?: string;
  gradedAt?: string;
}

export interface SqlAnswer {
  sql: string;
  resultPreview?: SqlResult;
  feedback?: Feedback;
  lastExecutedAt?: string;
}

export interface SqlResult {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  executionMs: number;
  truncated: boolean;
}

export interface Feedback {
  questionId: string;
  score: number;
  autoNotes?: string;
  instructorNotes?: string;
  rubricBreakdown: Array<{ criterionId: string; earned: number; comments?: string; }>;
}

export interface AuditLogEntry {
  id: string;
  actorId: string;
  action: 'create' | 'update' | 'publish' | 'execute_sql' | 'grade';
  targetId: string;
  targetType: 'homeworkSet' | 'question' | 'submission';
  metadata: Record<string, unknown>;
  createdAt: string;
}
```

### API Surface (Draft)
- `GET /api/homework` → list homework sets with filters by course, status; returns `HomeworkSet[]`.
- `POST /api/homework` → create homework set; accepts metadata, question skeletons; returns created `HomeworkSet`.
- `PATCH /api/homework/:setId` → update metadata, publish toggle, or archive.
- `GET /api/homework/:setId/questions` → fetch ordered `Question[]` with dataset references.
- `POST /api/homework/:setId/questions` → upsert question with schema, rubric, dataset binding.
- `DELETE /api/homework/:setId/questions/:questionId` → remove question (enforces max 10 rule).
- `GET /api/datasets` / `POST /api/datasets` → browse or create dataset descriptors; flags when backend migration required.
- `POST /api/sql/execute` → execute SQL against dataset sandbox; body includes `questionId`, `sql`, `executionContext`. Response wraps `SqlResult`.
- `POST /api/submissions/:setId/save-draft` → auto-save partial answers with optimistic response.
- `POST /api/submissions/:setId/submit` → lock submission, trigger grading pipeline.
- `GET /api/submissions/:setId` → fetch student submission + feedback; builder variant includes override controls.
- `POST /api/submissions/:submissionId/grade` → instructor overrides, rubric adjustments, audit log write.

All endpoints return problem+json error envelopes with `code`, `message`, and optional `remediation` field; React Query adapters centralize error surface.

GraphQL overlay (for dashboards and aggregated views):
- `query HomeworkSets($courseId: ID!, $status: [HomeworkStatus!])` → returns paginated sets with summary stats.
- `query HomeworkSetDetail($id: ID!)` → nested questions, dataset metadata, latest submission snapshot.
- `mutation UpsertQuestion($input: QuestionInput!)` → mirrors REST upsert while enabling optimistic updates in builder wizard.
- `subscription SubmissionFeedback($submissionId: ID!)` → streams rubric updates to students during manual grading.

### SQL Editor & Execution Integration
- Runner uses a sandboxed Monaco editor configured with SQL language services and custom linting to highlight disallowed statements before execution.
- Editor issues `executeSql({ questionId, sql })` mutations debounced at 500 ms to prevent hammering backend; rate limit (5 exec/min per question) enforced server-side.
- Execution channel streams status via SSE (`/api/sql/execute/stream`) for long-running queries; client displays progress spinner and auto-cancels at 8 s.
- Result viewer normalizes column typing, supports pagination (50 rows) and CSV download stub (pending backend confirmation).
- Builder preview reuses same editor component under read-only dataset snapshot to validate prompts and expected outputs.

### Security & Compliance Baseline
- Authentication: leverage existing session tokens; new middleware `requireRole('instructor')` wraps builder routes, while runner routes require enrolled student membership.
- Authorization Matrix: dataset CRUD and homework publish restricted to instructors; submission fetch limited to owner or privileged graders; audit logs readable by compliance role only.
- Audit Logging: every homework create/update, publish/unpublish, SQL execution, and grading action emits `AuditLogEntry` persisted via `/api/audit` service.
- Data Retention: submissions retained for 2 years; datasets flagged for review every term. Documented purge script coordinates with backend team.
- Privacy: no additional PII captured; reuse existing secrets manager for dataset credentials; ensure client never exposes raw connection strings.
- Compliance: align with SOC2 logging requirements; integrate accessibility review checklist into PR template.

### Acceptance Criteria & Stakeholder Sign-off
- Updated acceptance criteria validated with product + security stakeholders (see Acceptance Criteria section below for finalized list).
- Architecture blueprint, domain contracts, and API specs shared in design review (2024-02-18) with notes stored in `docs/homework-module/architecture-review.md` (to be created in Sprint 2 execution).
- Backend coordination scheduled to confirm dataset collection adjustments and execution endpoint rate-limits.

#### Implementation Status
- Routing, layout, and shared providers live under `app/homework` with `module.module.css` framing the Runner/Builder shell (`app/homework/layout.tsx`).
- Domain types and service adapters committed in `app/homework/types.ts` and `app/homework/services/*.ts` with mock-backed REST edges under `app/api/homework` and `app/api/datasets`.
- Middleware-enforced RBAC scaffolded in `middleware.ts`, guarding `/homework/builder` with a local 403 fallback page.

## Sprint 2 — Admin Builder Experience
**Goal:** Deliver a complete admin workflow for creating, managing, previewing, and publishing 10-question homework sets.

**Deliverables:**
- Responsive admin UI with creation wizards, question management, dataset reuse tools, and preview mode.
- Server-side handlers for CRUD operations against MongoDB, routed through the Node.js backend.
- Validation rules and draft tests covering homework creation and publication flows.

**Task Board:**
- [ x ] Implement routes/navigation for the Homework Builder dashboard with RBAC protection (admin/instructor roles only).
- [ x ] Develop creation wizard steps: metadata setup, dataset selection/creation, question authoring (10 question limit), grading rubric, and publishing controls.
- [ x ] Build question templates supporting SQL prompts, instructions, starter code, expected outputs, and auto-grading configs.
- [ x ] Add dataset browser to reuse existing materials and upload/manage new datasets (flag follow-up work for backend schema updates if needed).
- [ x ] Integrate preview mode to render student-facing view with test data.
- [ x ] Hook up API calls to Node.js services for persistence; log TODO for backend team where new endpoints or MongoDB collections are required.
- [ x ] Write unit/integration tests for form validation, state management, and publishing logic.

### Builder Dashboard & Routing
- Navigation lives under `app/homework/builder` with pages for dashboard (`page.tsx`), create wizard (`create/page.tsx`), edit (`[setId]/edit/page.tsx`), and preview (`[setId]/preview/page.tsx`).
- Middleware `middleware.ts` registers RBAC guard using shared `requireRole('instructor')`; unauthorized users redirected to `/403`.
- Sidebar links show filtered homework sets (Drafts, Scheduled, Published) via React Query hook `useHomeworkSets({ status })`; counts hydrate cards in dashboard summary.
- Breadcrumb + stepper context ensures consistent navigation between wizard steps and edit flows.

### Homework Creation Wizard
- Five-step wizard implemented with `WizardController` managing persisted draft state in React Query cache keyed by builder session.
- **MetadataStep** captures title, course, due date, visibility flags with inline validation (Zod schema `builderCreateMetadataSchema`).
- **DatasetStep** pulls datasets via `useDatasets` hook, supports cloning an existing dataset or launching `DatasetModal` for new uploads; raises TODO for backend to support dataset tagging search (see TODO list below).
- **QuestionsStep** enforces maximum of 10 `QuestionCard` entries; each card provides prompt, instructions, starter SQL, expected result JSON schema editor, points, and attempt limits. Drag-and-drop ordering implemented via `@dnd-kit/sortable`.
- **RubricStep** allows per-question rubric editing with default auto-graded criterion; manual overrides toggle replicates rubric to all questions.
- **PublishStep** summarizes key configuration, runs validation pipeline, and exposes `PublishControls` toggling `published` state with confirmation modal referencing audit log impact.
- Auto-save triggered on every dirty state change after 800 ms debounce, writing drafts via `POST /api/homework/:setId/draft` (backend TODO) or local storage when offline.

### Question Templates & Authoring
- Template definitions stored in `app/homework/builder/templates/questionTemplates.ts` with preset scaffolds (Basic Select, Join, Aggregation, Window Functions) that expand into question cards.
- Each template configures default starter SQL, expected results schema examples, rubric weighting, and recommended datasets.
- Builder warns when starter SQL references tables absent from selected dataset via schema diff check.
- `AutoGradingConfig` panel lets instructors pick evaluation mode (result match, custom assertion script, manual). Custom scripts flagged for backend review before enabling.

### Dataset Browser & Management
- `DatasetBrowser` component lists datasets with search, tag filters, and pagination; integrates `DatasetPreviewDrawer` to display table schemas and sample rows fetched via `/api/datasets/:id/preview`.
- New dataset flow uses multipart upload to send CSV bundle metadata to backend; TODO logged for Node.js API to support storing dataset provenance and retention policy acknowledgements.
- Reuse flow supports cloning dataset references so multiple homework sets can point to same dataset while tracking ownership metadata.

### Preview & Runner Parity
- Preview route renders Runner layout inside builder context by supplying mock `Submission` wired to `PreviewSubmissionProvider`.
- Instructors can switch between student, rubric, and SQL execution tabs to validate experience; preview respects dataset permissions but executes queries against staging sandbox flagged with `X-Preview-Mode` header.
- Builder logs preview executes to audit service with action `preview_execute_sql` for compliance tracing.

### API Integration & Backend Coordination
- React Query services (`homeworkService.ts`, `datasetService.ts`, `submissionService.ts`) now map to Sprint 1 REST endpoints; mutations handle optimistic updates and rollback with toast notifications.
- TODO for backend: add draft-saving endpoint (`POST /api/homework/:setId/draft`), dataset preview endpoint, and dataset tagging search parameter.
- `usePublishHomework` mutation emits audit events via `/api/audit` and invalidates dashboard caches upon success.

### Testing Strategy
- Unit tests (`__tests__/builder/*.test.tsx`) cover wizard step validation, rubric propagation, dataset modal interactions using React Testing Library.
- Integration tests simulate full builder flow with MSW mocking API responses, ensuring auto-save and publish calls trigger expected network requests.
- Playwright E2E script `tests/builder.spec.ts` exercises RBAC enforcement, wizard progression, preview mode, and publication toggle.
- Added TODO to coordinate with QA for dataset upload edge cases (large files, invalid CSV) once backend endpoints stabilize.

#### Implementation Status
- Builder dashboard (`app/homework/builder/page.tsx`) now consumes mock REST data with React Query filtering and navigation wiring through `BuilderShell`.
- Homework creation wizard implemented via `app/homework/builder/components/HomeworkWizard.tsx` and step components under `wizard/`, persisting drafts to mock APIs with debounced autosave.
- Edit and preview routes land in `app/homework/builder/[setId]/edit` and `/preview`, pulling existing sets via `useHomeworkDraft`.
- Supporting dataset browser hooks + in-memory API stubs ship inside `app/api/_mock/homeworkStore.ts` with endpoints to unblock front-end development.

## Sprint 3 — Student Runner Experience
**Goal:** Provide students with a seamless interface to follow instructions, answer 10 questions, execute SQL queries, and receive feedback.

**Deliverables:**
- Student-facing page with clear instructions, question navigation, and integrated SQL editor/executor.
- Execution pipeline connecting the editor to backend SQL sandbox services via the Node.js API.
- Real-time feedback UI displaying query results, grading status, and instructor comments.

**Task Board:**
- [ ] Implement homework landing page showing overall instructions, due dates, and completion status.
- [ ] Create per-question workspace: prompt display, SQL editor (with syntax highlighting, tabs per question, auto-save), and execution controls.
- [ ] Integrate with backend execution endpoint to run SQL safely; handle latency, errors, and result formatting.
- [ ] Display immediate feedback: query output tables, diff against expected results, rubric-based score, hints.
- [ ] Add progress tracking (completed questions, attempts remaining) with state synced to MongoDB submissions.
- [ ] Ensure accessibility (keyboard navigation, screen reader labels) and responsive design.
- [ ] Write end-to-end tests simulating a student completing all 10 questions and receiving grades.

## Sprint 4 — Grading, Publishing & QA
**Goal:** Finalize cross-cutting features, ensure quality, and prepare for production rollout.

**Deliverables:**
- End-to-end grading workflow supporting manual overrides and regrading.
- Audit logs and analytics hooks for both admin and student interactions.
- Comprehensive QA test suite and release checklist.

**Task Board:**
- [ ] Implement grading review dashboard for instructors: view submissions, adjust scores, add comments, and publish grades.
- [ ] Automate notifications (email/in-app) for published assignments and grade releases.
- [ ] Add analytics instrumentation (usage metrics, execution frequency) while respecting privacy policies.
- [ ] Perform security review focusing on SQL injection prevention, sandbox isolation, and RBAC enforcement.
- [ ] Conduct performance testing on editor execution endpoints and dataset loading.
- [ ] Finalize documentation: admin guide, student guide, runbooks, and deployment steps.
- [ ] Run regression test suite and resolve outstanding bugs before launch.

## Acceptance Criteria
- Students can open an assignment, read instructions, answer 10 questions, execute SQL queries safely, see results, and receive real-time grading feedback.
- Instructors can create, manage, preview, and publish 10-question homework sets, including reusing datasets and materials.
- All legacy code for the previous implementation is removed and replaced with the new architecture.
- Module integrates with the existing Node.js server and MongoDB for persistence, with clear contracts for any new collections or migrations.
- Security controls prevent unauthorized access, enforce role-based access, and ensure SQL execution occurs in a sandboxed environment.
- Automated tests (unit, integration, E2E) cover critical flows for both student and admin users.

## Architecture Overview
- **Front-end:** Modular Next.js/React components separated into Runner and Builder domains, sharing common utilities (types, hooks, data fetching).
- **Backend Integration:** Communicate exclusively through the established Node.js API layer; document any new endpoints (e.g., `/homework`, `/submissions`, `/datasets`, `/sql/execute`). Ensure payload contracts and error handling are versioned.
- **Data Model:** HomeworkSet → Questions (10 per set) → Submissions → Feedback. Datasets stored or referenced via MongoDB collections; coordinate schema updates with backend team.
- **State Management:** Use established client-state patterns (e.g., React Query/Redux) with optimistic updates, auto-save drafts, and cache invalidation strategies.
- **SQL Execution:** Route queries to backend sandbox service; enforce throttling, query timeout, and escaping rules. Display warnings for long-running queries and log execution metadata.

## Security & Compliance Checklist
- Enforce authentication and role-based authorization on all builder endpoints and UI routes.
- Sanitize all SQL inputs client-side and validate server-side; ensure backend sandbox prevents injection and resource abuse.
- Store minimal PII; leverage existing encryption and secrets management for API keys.
- Audit log key events (assignment creation, publish actions, query executions, grading changes).
- Adhere to accessibility standards (WCAG 2.1 AA) and internal privacy policies.

## Additional Notes
- Any MongoDB schema changes or new collections must be coordinated with the backend Node.js team; update infrastructure scripts and provide migration instructions.
- Maintain backward compatibility for unrelated modules; do not modify shared services without approvals.
- Keep documentation and changelogs up to date for each sprint and ensure deployment checklists are completed before release.
