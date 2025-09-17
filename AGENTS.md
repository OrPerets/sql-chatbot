# Full Homework Exercise Module Rebuild Guidelines (Exam & Grade-by-Question Pages)

This document outlines the phased implementation plan for rebuilding the Full Homework Exercise module in Michael, focusing on the exam page and all admin pages related to grade-by-question.

⚠️ Important: The practice option available through the Michael chat button must remain untouched and fully operational. This rebuild affects only the exam-related and grading-related flows.

The existing exam/grade-by-question implementation must be fully removed before introducing the new solution. Follow the sprint structure below to deliver the new student (runner) and instructor/admin (builder) experiences while maintaining integration with the Node.js + MongoDB backend services.


---

## Sprint 0 — Discovery & Teardown

**Goal**: Understand current shortcomings and prepare the codebase for a complete rebuild of the exam and grade-by-question flows.

Sprint 0 removed the legacy "Full Homework Exercise" exam and grade-by-question implementation from the mentor server while leaving the practice modal untouched.

See docs/sprint-0-discovery.md for the teardown inventory, shared dependency notes, and follow-up tasks before rebuilding the module.
Guiding Principles


## Sprint 1 — Architecture & Foundations
**Goal:** Establish the technical blueprint and baseline infrastructure for the new module.

**Deliverables:**
- Approved architecture diagram covering front-end components, API contracts, and data flow with Node.js + MongoDB services.
- Interface definitions for both Runner (student) and Builder (admin) modules, including routing and navigation updates.
- Security and compliance checklist covering auth, RBAC, and data handling.

**Task Board:**
- [ ] Design the high-level component hierarchy (pages, layouts, editors, services) for student and admin experiences.
- [ ] Define shared domain models (HomeworkSet, Question, Submission, Feedback, Dataset) and TypeScript interfaces.
- [ ] Draft REST/GraphQL API specs for CRUD operations, execution requests, grading feedback, and dataset management.
- [ ] Document integration points for the online SQL editor/executor, ensuring sandboxing and rate-limits.
- [ ] Produce security requirements: authentication guardrails, authorization matrix, audit logging, and data retention policies.
- [ ] Outline acceptance criteria for the entire module (see section below) and obtain stakeholder sign-off.

## Sprint 2 — Admin Builder Experience
**Goal:** Deliver a complete admin workflow for creating, managing, previewing, and publishing 10-question homework sets.

**Deliverables:**
- Responsive admin UI with creation wizards, question management, dataset reuse tools, and preview mode.
- Server-side handlers for CRUD operations against MongoDB, routed through the Node.js backend.
- Validation rules and draft tests covering homework creation and publication flows.

**Task Board:**
- [ ] Implement routes/navigation for the Homework Builder dashboard with RBAC protection (admin/instructor roles only).
- [ ] Develop creation wizard steps: metadata setup, dataset selection/creation, question authoring (10 question limit), grading rubric, and publishing controls.
- [ ] Build question templates supporting SQL prompts, instructions, starter code, expected outputs, and auto-grading configs.
- [ ] Add dataset browser to reuse existing materials and upload/manage new datasets (flag follow-up work for backend schema updates if needed).
- [ ] Integrate preview mode to render student-facing view with test data.
- [ ] Hook up API calls to Node.js services for persistence; log TODO for backend team where new endpoints or MongoDB collections are required.
- [ ] Write unit/integration tests for form validation, state management, and publishing logic.

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
