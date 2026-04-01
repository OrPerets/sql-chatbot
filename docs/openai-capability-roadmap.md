# OpenAI Capability Roadmap for Michael (SQL Teaching Assistant)

_Last reviewed: March 31, 2026_

This document summarizes high-impact OpenAI platform capabilities that can improve Michael's student experience, reliability, observability, and operating cost.

## Sources reviewed

- OpenAI API docs: Tools guide (web search, file search, function calling, remote MCP, tool search)
  - https://developers.openai.com/api/docs/guides/tools
- OpenAI API docs: Realtime guide
  - https://developers.openai.com/api/docs/guides/realtime
- OpenAI API docs: Batch guide
  - https://developers.openai.com/api/docs/guides/batch
- OpenAI API docs: Background mode guide
  - https://developers.openai.com/api/docs/guides/background
- OpenAI API docs: Evals guide
  - https://developers.openai.com/api/docs/guides/evals
- OpenAI API docs: Flex processing guide
  - https://developers.openai.com/api/docs/guides/flex-processing
- OpenAI API docs: Prompt caching guide
  - https://developers.openai.com/api/docs/guides/prompt-caching
- OpenAI API docs: Model optimization guide
  - https://developers.openai.com/api/docs/guides/model-optimization

---

## 1) Features to add in Michael (student + admin)

### A. Retrieval-native tutoring with File Search + Vector Stores

**What to add**
- Ingest course PDFs, homework rubrics, and SQL schema guides into a vector store.
- Use `file_search` tool in chat/summarization endpoints so explanations are grounded in local curriculum.
- Return citations/snippets to students in responses.

**Why this helps**
- Improves factual alignment to course material.
- Reduces hallucinations and keeps answers aligned to professor expectations.

**Where it likely fits now**
- Student tutor routes in `app/api/*` and interactive learning summarize endpoints.

### B. Dynamic tool routing with Tool Search + Remote MCP

**What to add**
- Register internal capability tools (SQL execution sandbox, grading lookup, homework metadata fetch, student profile fetch) with semantic descriptions.
- Add a remote MCP server for internal services (gradebook, LMS exports, content registry).
- Let model discover and call only relevant tools per request.

**Why this helps**
- Cleaner than static tool lists in every request.
- Better scaling as Michael grows from "chatbot" to multi-tool teaching agent.

### C. Realtime voice tutoring over WebRTC

**What to add**
- Migrate voice mode from chained request/response to Realtime API sessions for lower-latency conversational UX.
- Add interruption handling and partial speech response for "think aloud" SQL debugging.

**Why this helps**
- Makes voice tutoring feel more natural and less turn-based.
- Better accessibility and engagement for students who learn verbally.

### D. Background mode for long-running analysis

**What to add**
- Use background responses for heavy workflows:
  - full-assignment AI grading pass
  - weekly student profile synthesis
  - long PDF summary generation
- Store status in Mongo and poll/update asynchronously in UI.

**Why this helps**
- Prevents API timeouts and improves reliability for large jobs.
- Smoother UX versus blocking page requests.

### E. Batch API for nightly jobs

**What to add**
- Move non-urgent cron-style pipelines to Batch API:
  - nightly feedback regeneration
  - cohort analytics
  - backlog rubric normalization

**Why this helps**
- Better cost control and throughput for large asynchronous workloads.

---

## 2) Infrastructure upgrades (quality, safety, cost)

### A. Evals as a release gate

**What to add**
- Build SQL-focused eval suite:
  - query correctness
  - pedagogy quality
  - rubric conformance
  - safety policy adherence
- Run evals for every model prompt/version change in CI before rollout.

**Why this helps**
- Prevents quality regressions when changing models/system prompts.
- Turns "prompt edits" into measurable, testable releases.

### B. Prompt Caching for repeated scaffolds

**What to add**
- Ensure long stable prefixes (system instructions, rubric templates, schema context) are reused across requests to maximize cache hits.
- Refactor prompt assembly so dynamic content is appended after shared prefix blocks.

**Why this helps**
- Lower latency and token cost on repeated educational workflows.

### C. Flex Processing for non-urgent inference

**What to add**
- Route low-priority tasks to flex tier (e.g., retrospective analytics and offline summaries).

**Why this helps**
- Lower operating cost while preserving premium latency for live tutoring.

### D. Reliability envelope + model optimization

**What to add**
- Central model/router policy:
  - default lightweight model for chat hints
  - escalate to larger model for grading, synthesis, or ambiguous student intents
- Add retries, circuit breakers, and explicit fallback model chain.

**Why this helps**
- Balances quality, latency, and cost under real classroom load.

---

## 3) New "skills" Michael should have (product behavior)

### 1) `sql-debugger`
- Diagnoses student query errors against expected schema and sample rows.
- Produces stepwise hints before giving full solution.

### 2) `rubric-grader`
- Scores answers against assignment rubric dimensions.
- Explains deductions with specific correction guidance.

### 3) `misconception-coach`
- Detects recurring conceptual gaps (joins, grouping, subqueries, null semantics).
- Generates targeted mini-lessons and follow-up checks.

### 4) `office-hours-simulator`
- Runs Socratic multi-turn tutoring with adjustable strictness and pacing.
- Supports beginner/intermediate/advanced tutoring personas.

### 5) `assessment-auditor`
- Reviews generated quizzes/homework for leakage, ambiguity, and difficulty balance.
- Flags unfair or duplicate questions before release.

### 6) `student-progress-analyst`
- Converts interaction + homework history into weekly interventions.
- Produces advisor-ready reports and at-risk alerts.

---

## 4) Suggested rollout plan

### Phase 1 (1-2 sprints): quick wins
1. Add prompt caching-friendly prompt structure.
2. Move long-running summarize/grading to background mode.
3. Stand up first eval set for SQL correctness + safety.

### Phase 2 (2-4 sprints): scale and quality
1. Introduce file search grounding for curriculum documents.
2. Shift nightly analytics to batch/flex pathways.
3. Add model routing policy and fallback behavior.

### Phase 3 (ongoing): agent expansion
1. Add remote MCP integrations for internal data/tools.
2. Implement skill-oriented tool architecture (`sql-debugger`, `rubric-grader`, etc.).
3. Add continuous eval dashboards and regression alerts.

---

## 5) Concrete engineering tasks for this repo

1. Add a unified `openaiClient` wrapper with tool routing + model policy.
2. Add `evals/` fixtures for canonical SQL prompts and expected outputs.
3. Add queue workers for background jobs (summary, grading, profile synthesis).
4. Add `vector-store` ingestion script for PDFs/rubrics and retrieval endpoint wiring.
5. Add telemetry fields (request class, tool used, model, latency, cache hit) to logs.
6. Add batch/flex job scheduler for non-urgent workload classes.

---

## 6) KPIs to track after implementation

- Student resolution rate without human escalation
- First-helpful-answer rate
- SQL correctness score on eval set
- Mean tutoring latency (text and voice separately)
- Cost per student per week
- Regression rate after model/prompt changes

