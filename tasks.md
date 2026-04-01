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
- [ ] Create an Architecture Decision Record (ADR) for OpenAI integration strategy:
  - [ ] Primary request path (sync chat)
  - [ ] Async path (background + batch)
  - [ ] Tool invocation strategy (direct tools + remote MCP)
  - [ ] Failure domains and fallback order
- [ ] Define canonical `SkillDefinition` schema used across backend/frontend:
  - [ ] `id` (e.g., `sql-debugger`)
  - [ ] `displayName`, `description`
  - [ ] `inputSchema`, `outputSchema`
  - [ ] `safetyConstraints`
  - [ ] `telemetryTags`
- [ ] Define shared `TaskClass` enum for routing:
  - [ ] `live_tutoring`
  - [ ] `grading`
  - [ ] `long_summary`
  - [ ] `nightly_analytics`
  - [ ] `content_audit`

#### 0.2 Quality + rollout controls
- [ ] Add feature flags for each Section 1 capability:
  - [ ] `ff_file_search`
  - [ ] `ff_tool_search_mcp`
  - [ ] `ff_realtime_voice`
  - [ ] `ff_background_mode`
  - [ ] `ff_batch_jobs`
- [ ] Add skill-level flags for each Section 3 skill:
  - [ ] `ff_skill_sql_debugger`
  - [ ] `ff_skill_rubric_grader`
  - [ ] `ff_skill_misconception_coach`
  - [ ] `ff_skill_office_hours_simulator`
  - [ ] `ff_skill_assessment_auditor`
  - [ ] `ff_skill_student_progress_analyst`
- [ ] Add baseline telemetry fields in all AI request logs:
  - [ ] `request_id`, `student_id/admin_id`, `route`
  - [ ] `task_class`, `skill_id`
  - [ ] `model`, `tool_used[]`, `latency_ms`
  - [ ] `cache_hit` (if available), `fallback_triggered`
  - [ ] token usage and cost estimate

#### 0.3 Exit criteria
- [ ] Contracts are reviewed by product + engineering.
- [ ] Feature flags are wired end-to-end.
- [ ] Logs provide enough data to compare old vs new behavior.

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
- [ ] Build ingestion script/service for course artifacts:
  - [ ] PDFs (lectures, homework, rubric docs)
  - [ ] SQL schema guides
  - [ ] solution explanation docs (if approved)
- [ ] Implement chunking strategy (size + overlap) and attach metadata:
  - [ ] `course_id`, `term`, `doc_type`, `module`, `version`
- [ ] Add versioning and re-index workflow:
  - [ ] detect changed files
  - [ ] incremental upsert
  - [ ] safe delete of stale chunks
- [ ] Add ingestion validation checks:
  - [ ] chunk count threshold
  - [ ] metadata completeness
  - [ ] broken/empty file detection

#### 1.2 Retrieval in tutoring routes
- [ ] Wire `file_search` tool into student tutor endpoint(s).
- [ ] Enforce citation/snippet requirement in response formatter.
- [ ] Add fallback path when retrieval fails:
  - [ ] return constrained general guidance
  - [ ] include “couldn’t find exact course source” marker
- [ ] Add admin debug panel/log output for retrieval traces:
  - [ ] top-k chunks
  - [ ] source doc ids
  - [ ] retrieval latency

#### 1.3 `sql-debugger` skill MVP
- [ ] Implement skill prompt + tool contract:
  - [ ] inputs: student SQL, expected objective, schema context
  - [ ] outputs: diagnosis, stepwise hints, optional full fix
- [ ] Add pedagogical policy:
  - [ ] first response gives hints, not full answer
  - [ ] configurable “reveal answer” threshold
- [ ] Add error taxonomy detection:
  - [ ] syntax
  - [ ] wrong join keys
  - [ ] grouping/aggregation misuse
  - [ ] null-handling mistakes
- [ ] Add deterministic unit fixtures for common query failures.

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
- [ ] Register internal tools with semantic descriptions:
  - [ ] SQL sandbox execution
  - [ ] grading lookup
  - [ ] homework metadata fetch
  - [ ] student profile fetch
- [ ] Stand up remote MCP server adapter for internal systems:
  - [ ] gradebook
  - [ ] LMS exports
  - [ ] content registry
- [ ] Add allowlist and auth boundaries:
  - [ ] per-role tool access (student vs admin)
  - [ ] per-route tool constraints
- [ ] Add tool-call observability:
  - [ ] selected tool reason
  - [ ] call duration
  - [ ] error class

#### 2.2 `rubric-grader` implementation
- [ ] Define rubric dimension schema (weights + criteria + examples).
- [ ] Build grading pipeline:
  - [ ] parse rubric
  - [ ] evaluate student response
  - [ ] produce dimension scores + rationale
  - [ ] generate correction guidance
- [ ] Add confidence flags and escalation logic:
  - [ ] low confidence => “review required” state
- [ ] Build admin-facing grader output audit view.

#### 2.3 Exit criteria
- [ ] Tools are selected dynamically with no hardcoded per-route tool arrays for migrated routes.
- [ ] `rubric-grader` outputs structured scores + rationale consistently.
- [ ] Permission model blocks disallowed tool calls by role.

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
