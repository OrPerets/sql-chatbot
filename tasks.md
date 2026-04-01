# Michael Capability Implementation Plan (Sections 1 + 3)

This plan translates roadmap **Section 1 (platform features)** and **Section 3 (product skills)** into executable engineering sprints with clear deliverables, dependencies, and TODO checklists.

---

## Sprint 0 — Foundation & Delivery Safety (1 week)

### Goals
- Establish architecture and guardrails needed to safely ship features from Section 1.
- Define skill contracts before implementation so behavior is consistent across student + admin surfaces.

### Scope
- Core architecture decisions
- Shared schemas/contracts
- Observability and rollout controls

### Detailed TODOs

#### 0.1 Architecture and contracts
- [x] Create an Architecture Decision Record (ADR) for OpenAI integration strategy:
  - [x] Primary request path (sync chat)
  - [x] Async path (background + batch)
  - [x] Tool invocation strategy (direct tools + remote MCP)
  - [x] Failure domains and fallback order
- [x] Define canonical `SkillDefinition` schema used across backend/frontend:
  - [x] `id` (e.g., `sql-debugger`)
  - [x] `displayName`, `description`
  - [x] `inputSchema`, `outputSchema`
  - [x] `safetyConstraints`
  - [x] `telemetryTags`
- [x] Define shared `TaskClass` enum for routing:
  - [x] `live_tutoring`
  - [x] `grading`
  - [x] `long_summary`
  - [x] `nightly_analytics`
  - [x] `content_audit`

#### 0.2 Quality + rollout controls
- [x] Add feature flags for each Section 1 capability:
  - [x] `ff_file_search`
  - [x] `ff_tool_search_mcp`
  - [x] `ff_realtime_voice`
  - [x] `ff_background_mode`
  - [x] `ff_batch_jobs`
- [x] Add skill-level flags for each Section 3 skill:
  - [x] `ff_skill_sql_debugger`
  - [x] `ff_skill_rubric_grader`
  - [x] `ff_skill_misconception_coach`
  - [x] `ff_skill_office_hours_simulator`
  - [x] `ff_skill_assessment_auditor`
  - [x] `ff_skill_student_progress_analyst`
- [x] Add baseline telemetry fields in all AI request logs:
  - [x] `request_id`, `student_id/admin_id`, `route`
  - [x] `task_class`, `skill_id`
  - [x] `model`, `tool_used[]`, `latency_ms`
  - [x] `cache_hit` (if available), `fallback_triggered`
  - [x] token usage and cost estimate

#### 0.3 Exit criteria
- [x] Contracts are reviewed by product + engineering.
- [x] Feature flags are wired end-to-end.
- [x] Logs provide enough data to compare old vs new behavior.

---

## Sprint 1 — Retrieval-native tutoring + `sql-debugger` MVP (2 weeks)

### Goals
- Ship curriculum-grounded responses using File Search + Vector Stores.
- Launch first student skill: `sql-debugger`.

### Section mapping
- Section 1A: Retrieval-native tutoring
- Section 3.1: `sql-debugger`

### Detailed TODOs

#### 1.1 Document ingestion pipeline
- [x] Build ingestion script/service for course artifacts:
  - [x] PDFs (lectures, homework, rubric docs)
  - [x] SQL schema guides
  - [x] solution explanation docs (if approved)
- [x] Implement chunking strategy (size + overlap) and attach metadata:
  - [x] `course_id`, `term`, `doc_type`, `module`, `version`
- [x] Add versioning and re-index workflow:
  - [x] detect changed files
  - [x] incremental upsert
  - [x] safe delete of stale chunks
- [x] Add ingestion validation checks:
  - [x] chunk count threshold
  - [x] metadata completeness
  - [x] broken/empty file detection

#### 1.2 Retrieval in tutoring routes
- [x] Wire `file_search` tool into student tutor endpoint(s).
- [x] Enforce citation/snippet requirement in response formatter.
- [x] Add fallback path when retrieval fails:
  - [x] return constrained general guidance
  - [x] include “couldn’t find exact course source” marker
- [x] Add admin debug panel/log output for retrieval traces:
  - [x] top-k chunks
  - [x] source doc ids
  - [x] retrieval latency
- [x] Add student-intent retrieval handling for curriculum lookup chat prompts:
  - [x] detect prompts like “what tables exist in practice 2”
  - [x] detect prompts like “what examples have in lecture 4”
  - [x] answer with retrieved, source-grounded tables/examples from the referenced practice or lecture materials

#### 1.3 `sql-debugger` skill MVP
- [x] Implement skill prompt + tool contract:
  - [x] inputs: student SQL, expected objective, schema context
  - [x] outputs: diagnosis, stepwise hints, optional full fix
- [x] Add pedagogical policy:
  - [x] first response gives hints, not full answer
  - [x] configurable “reveal answer” threshold
- [x] Add error taxonomy detection:
  - [x] syntax
  - [x] wrong join keys
  - [x] grouping/aggregation misuse
  - [x] null-handling mistakes
- [x] Add deterministic unit fixtures for common query failures.

#### 1.4 Exit criteria
- [ ] ≥80% of tutoring responses for covered modules contain valid citations.
- [ ] `sql-debugger` provides at least one actionable hint before full solution.
- [ ] No P1 regressions in existing tutoring routes.

---

## Sprint 2 — Dynamic tools + rubric-centric grading (2 weeks)

### Goals
- Replace rigid tool lists with discoverable tool routing.
- Launch `rubric-grader` for assignment evaluation quality.

### Section mapping
- Section 1B: Tool Search + Remote MCP
- Section 3.2: `rubric-grader`

### Detailed TODOs

#### 2.1 Tool Search + Remote MCP integration
- [x] Register internal tools with semantic descriptions:
  - [x] SQL sandbox execution
  - [x] grading lookup
  - [x] homework metadata fetch
  - [x] student profile fetch
- [x] Stand up remote MCP server adapter for internal systems:
  - [x] gradebook
  - [x] LMS exports
  - [x] content registry
- [x] Add allowlist and auth boundaries:
  - [x] per-role tool access (student vs admin)
  - [x] per-route tool constraints
- [x] Add tool-call observability:
  - [x] selected tool reason
  - [x] call duration
  - [x] error class

#### 2.2 `rubric-grader` implementation
- [x] Define rubric dimension schema (weights + criteria + examples).
- [x] Build grading pipeline:
  - [x] parse rubric
  - [x] evaluate student response
  - [x] produce dimension scores + rationale
  - [x] generate correction guidance
- [x] Add confidence flags and escalation logic:
  - [x] low confidence => “review required” state
- [x] Build admin-facing grader output audit view.

#### 2.3 Exit criteria
- [x] Tools are selected dynamically with no hardcoded per-route tool arrays for migrated routes.
- [x] `rubric-grader` outputs structured scores + rationale consistently.
- [x] Permission model blocks disallowed tool calls by role.

---

## Sprint 3 — Realtime voice + coaching behaviors (2 weeks)

### Goals
- Improve conversational tutoring with low-latency voice.
- Ship conceptual coaching skills for deeper learning.

### Section mapping
- Section 1C: Realtime voice tutoring
- Section 3.3: `misconception-coach`
- Section 3.4: `office-hours-simulator`

### Detailed TODOs

#### 3.1 Realtime voice infrastructure
- [ ] Integrate Realtime API session lifecycle:
  - [ ] session create/refresh
  - [ ] token/session security controls
  - [ ] reconnect behavior
- [ ] Implement interruption handling:
  - [ ] stop speaking when student interjects
  - [ ] preserve conversational state
- [ ] Add partial response streaming UX cues.
- [ ] Add voice-mode telemetry:
  - [ ] first audio latency
  - [ ] interruptions count
  - [ ] session drop rate

#### 3.2 `misconception-coach`
- [ ] Build misconception classifier over interaction history:
  - [ ] joins
  - [ ] grouping
  - [ ] subqueries
  - [ ] null semantics
- [ ] Generate targeted mini-lessons per misconception tag.
- [ ] Add follow-up check questions and mastery tracking.

#### 3.3 `office-hours-simulator`
- [ ] Implement Socratic dialogue policy with pacing controls.
- [ ] Add persona profiles:
  - [ ] beginner
  - [ ] intermediate
  - [ ] advanced
- [ ] Add strictness slider and “hint frequency” controls.

#### 3.4 Exit criteria
- [ ] Realtime sessions maintain stable multi-turn flow under interruption.
- [ ] Coaching skills personalize follow-ups based on detected gaps.
- [ ] Persona/strictness settings are reflected in generated tutor behavior.

---

## Sprint 4 — Long-running workflows + assessment quality controls (2 weeks)

### Goals
- Move heavy operations to asynchronous pathways.
- Prevent low-quality/unsafe assessments before release.

### Section mapping
- Section 1D: Background mode
- Section 3.5: `assessment-auditor`

### Detailed TODOs

#### 4.1 Background mode migration
- [ ] Identify and migrate long-running jobs:
  - [ ] full-assignment grading pass
  - [ ] weekly student profile synthesis
  - [ ] long PDF summary generation
- [ ] Implement persistent job model in Mongo:
  - [ ] status lifecycle (`queued`, `running`, `succeeded`, `failed`)
  - [ ] progress updates
  - [ ] failure reason payloads
- [ ] Build async UI polling/status components for student/admin views.
- [ ] Add retry + dead-letter handling for failed jobs.

#### 4.2 `assessment-auditor`
- [ ] Implement pre-release audit checks:
  - [ ] answer leakage detection
  - [ ] ambiguity detection
  - [ ] duplicate/near-duplicate question detection
  - [ ] difficulty distribution balance
- [ ] Produce actionable audit report with severity levels.
- [ ] Add “block publish on high severity” control.

#### 4.3 Exit criteria
- [ ] No blocking HTTP timeouts for migrated workflows.
- [ ] Assessment pipeline has enforced pre-release audit gate.
- [ ] Operators can inspect failed background jobs with root-cause details.

---

## Sprint 5 — Batch economics + progress intelligence (2 weeks)

### Goals
- Shift non-urgent workloads to Batch API for cost/throughput.
- Deliver intervention-focused analytics via `student-progress-analyst`.

### Section mapping
- Section 1E: Batch API for nightly jobs
- Section 3.6: `student-progress-analyst`

### Detailed TODOs

#### 5.1 Batch pipeline
- [ ] Define batch candidates and cutover plan:
  - [ ] nightly feedback regeneration
  - [ ] cohort analytics
  - [ ] rubric normalization backlog
- [ ] Build batch submitter + result ingester jobs.
- [ ] Add idempotency keys and duplicate-run protection.
- [ ] Add cost/throughput dashboard for batch operations.

#### 5.2 `student-progress-analyst`
- [ ] Aggregate multi-source student signals:
  - [ ] tutoring interactions
  - [ ] homework performance
  - [ ] misconception trends
- [ ] Generate weekly intervention recommendations.
- [ ] Create advisor-ready report format + at-risk flags.
- [ ] Add admin review workflow before sending alerts.

#### 5.3 Exit criteria
- [ ] Nightly non-urgent pipelines run via batch successfully.
- [ ] Weekly intervention reports are generated and reviewable.
- [ ] At-risk alerts include evidence + recommended next actions.

---

## Cross-sprint non-functional checklist (run every sprint)

### Reliability
- [ ] Retry policy with capped exponential backoff for all API/tool calls.
- [ ] Fallback model/tool path documented and tested.
- [ ] Circuit breaker protection for unstable dependencies.

### Safety and governance
- [ ] Role-based access checks for all admin capabilities.
- [ ] Prompt/content guardrails for student-safe tutoring behavior.
- [ ] Audit logs for grading and assessment decisions.

### QA and evaluation
- [ ] Add/update eval cases tied to each new skill.
- [ ] Regression tests for existing tutoring and grading flows.
- [ ] Pre-release smoke test checklist for top 10 student journeys.

### Observability
- [ ] Dashboard by skill: usage, success rate, latency, fallback rate.
- [ ] Dashboard by feature flag cohort: quality and cost deltas.
- [ ] Weekly KPI review against roadmap outcomes.

---

## Suggested implementation order summary
1. Foundation + contracts (Sprint 0)
2. Retrieval + `sql-debugger` (Sprint 1)
3. Tool routing + `rubric-grader` (Sprint 2)
4. Realtime + coaching skills (Sprint 3)
5. Background jobs + assessment auditing (Sprint 4)
6. Batch economics + progress analyst (Sprint 5)

This sequence minimizes risk by shipping grounding and controllability first, then expanding capability breadth.
