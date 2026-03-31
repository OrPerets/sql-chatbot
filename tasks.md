# Michael Implementation Roadmap

Updated: 2026-03-31

## Goal

Turn Michael from a strong SQL tutor with custom tools into a more capable teaching platform with:

- trusted external knowledge access for instructors
- better long-running job handling
- higher-precision retrieval
- stronger student personalization

## Planning assumptions

- Michael remains Responses API first
- student-facing chat stays tightly scoped and safe
- external-data tools are introduced in admin / instructor workflows before student exposure
- grading and evaluation flows remain isolated from web-connected tools

## Sprint 0: Foundation Audit And Delivery Prep

### Objectives

- align the roadmap with the current repo architecture
- define implementation boundaries before adding new tools
- prepare observability and flags for incremental rollout

### Todo

- [x] Audit all current tool entry points in `lib/openai/tools.ts`
- [x] Document tool-context boundaries for `main_chat`, `homework_runner`, `admin`, and `voice`
- [x] Add or update feature flags for:
  - `FEATURE_OPENAI_WEB_SEARCH`
  - `FEATURE_OPENAI_CONNECTORS`
  - `FEATURE_RESPONSES_BACKGROUND`
  - `FEATURE_PERSONALIZATION_TOOLS`
- [x] Define a small internal schema for tool rollout metadata:
  - enabled contexts
  - allowed user roles
  - rollout phase
  - logging sensitivity
- [x] Add admin-visible runtime diagnostics page updates so new tool states are inspectable
- [x] Decide whether tool usage logs live only in app logs or also in Mongo collections

### Deliverables

- feature-flag plan
- rollout matrix by context
- logging plan for hosted tools and custom tools

### Validation

- [x] Verify existing `POST /api/responses/messages` flow still works unchanged
- [x] Verify current `file_search` and custom tool loop still pass existing tests

## Sprint 1: Admin Web Search

### Objectives

- add OpenAI `web_search` as a built-in tool
- keep it admin-only initially
- render citations clearly in the UI

### Todo

- [x] Extend tool-building logic so admin responses can include `web_search`
- [x] Keep `web_search` disabled for:
  - student main chat
  - homework runner
  - grading
  - evaluation jobs
- [x] Add admin prompt rules for when web search is allowed:
  - only for current, external, or documentation-style questions
  - not for course truth when internal files already cover the answer
- [x] Update response parsing to capture web-search output items
- [x] Add citation rendering support in admin views
- [x] Add event logging for:
  - tool used
  - query issued
  - source count
  - latency
- [x] Add fallback behavior when web search is unavailable or rate limited

### Deliverables

- admin-only `web_search` support
- visible source citations in the UI
- usage logging for web-search calls

### Validation

- [x] Add unit tests for tool selection rules
- [x] Add integration test for admin query that uses `web_search`
- [x] Verify no `web_search` tool appears in student contexts

## Sprint 2: Instructor Connectors And MCP

### Objectives

- connect Michael to trusted instructor data sources
- begin with official OpenAI connectors or official MCP servers only
- support read-only instructor workflows first

### Todo

- [x] Define first-wave integrations:
  - Google Drive
  - Gmail
  - Google Calendar
  - Google Sheets or Drive-based tabular inputs
- [x] Decide per integration whether to use:
  - OpenAI connector
  - official remote MCP server
  - internal wrapper tool
- [x] Expand `list_instructor_mcp_capabilities` so it returns real configured capabilities
- [x] Add admin config surface for connected services and their status
- [x] Add role gating so only instructors / admins can use these tools
- [x] Add prompt rules for data minimization:
  - do not send student-sensitive data into remote MCP unless required
  - prefer read-only flows
- [x] Add logging for remote MCP / connector calls
- [x] Add connector-specific tool labels in the UI so instructors know which source Michael used

### Deliverables

- first-wave instructor integrations
- admin capability manifest
- role-gated remote data access

### Validation

- [x] Test Drive-backed course-doc question answering
- [x] Test Calendar-backed deadline lookup
- [x] Test Gmail-backed clarification retrieval
- [x] Verify connectors are unavailable in student chat

## Sprint 3: Background Jobs And Webhooks

### Objectives

- support long-running Responses API jobs safely
- stop stretching synchronous request windows for heavy admin work
- process `response.completed` events with verified webhooks

### Todo

- [ ] Identify background-eligible flows:
  - exam generation
  - bulk student analysis
  - large PDF summarization
  - corpus reindexing
- [ ] Add a background execution path using `background: true`
- [ ] Create webhook endpoint for OpenAI events
- [ ] Verify webhook signatures using `OPENAI_WEBHOOK_SECRET`
- [ ] Store background job state:
  - queued
  - running
  - completed
  - failed
- [ ] Add UI polling or notification mechanism for admin jobs
- [ ] Add idempotency handling using webhook IDs
- [ ] Offload heavy post-processing away from the webhook request handler
- [ ] Add retry and failure surfaces for admin visibility

### Deliverables

- background-mode admin jobs
- verified webhook ingestion
- persisted job state and admin visibility

### Validation

- [ ] Test successful `response.completed` flow end to end
- [ ] Test duplicate webhook delivery handling
- [ ] Test invalid-signature rejection
- [ ] Test long-running admin job without blocking request lifecycle

## Sprint 4: Structured File Search And Course Corpus

### Objectives

- improve retrieval precision
- move from a generic shared vector store to a structured course knowledge base
- reduce cross-week and cross-homework retrieval noise

### Todo

- [ ] Define vector-store metadata strategy:
  - `week`
  - `homework_set_id`
  - `doc_type`
  - `language`
  - `course_term`
  - `source_priority`
- [ ] Update upload flows in `app/api/responses/files/route.ts` to attach metadata
- [ ] Add admin file-management UI fields for metadata tagging
- [ ] Add metadata filtering in retrieval requests where the question is scoped
- [ ] Split or logically partition the current shared vector store if needed
- [ ] Add admin "reindex corpus" action
- [ ] Add ingestion rules for:
  - weekly notes
  - homework docs
  - FAQ / policy docs
  - worked examples
- [ ] Add source-priority rules so official course material outranks secondary docs
- [ ] Improve visible citation formatting for file-search results

### Deliverables

- metadata-aware retrieval
- admin-managed course corpus
- better-scoped citations

### Validation

- [ ] Add tests for metadata filter generation
- [ ] Verify week-scoped questions retrieve only relevant material
- [ ] Verify homework-specific questions prioritize matching homework docs
- [ ] Compare answer quality before and after metadata filtering on a small eval set

## Sprint 5: Student Personalization Tools

### Objectives

- give Michael stronger memory of student progress
- make tutoring hints depend on recent attempts and actual weaknesses
- recommend the next useful action, not just answer the immediate question

### Todo

- [ ] Implement `get_student_progress_snapshot`
- [ ] Implement `get_recent_submission_attempts`
- [ ] Implement `get_deadline_and_schedule_context`
- [ ] Implement `recommend_next_learning_step`
- [ ] Implement `generate_personalized_quiz_from_mistakes`
- [ ] Add strict schemas for each tool
- [ ] Define safe data exposure rules so only the needed student fields are returned
- [ ] Update tutoring prompts so Michael uses these tools deliberately rather than on every turn
- [ ] Add "recommended next step" UI hook in chat or homework runner
- [ ] Add analytics for whether recommended next steps are followed

### Deliverables

- personalized tutoring toolset
- student-aware hinting
- next-step recommendation flow

### Validation

- [ ] Add unit tests for each tool schema and executor
- [ ] Add integration tests for common tutoring scenarios
- [ ] Verify Michael changes its hint strategy when recent failed attempts exist
- [ ] Verify no unnecessary student data leaks into tool payloads

## Sprint 6: Relational Algebra Tutor Support

### Objectives

- let Michael teach through relational algebra, not only SQL
- connect tutoring logic to the existing relational-algebra UI pieces

### Todo

- [ ] Implement `explain_relational_algebra_step`
- [ ] Add prompt rules for when Michael should switch from SQL explanation to RA explanation
- [ ] Map common SQL constructs to RA representations used in the app
- [ ] Add UI rendering support if Michael returns structured RA steps
- [ ] Decide whether this tool should be available in:
  - student main chat
  - homework runner
  - interactive learning only
- [ ] Add examples for joins, selections, projections, grouping, and nested logic where relevant

### Deliverables

- RA explanation tool
- RA-aware tutoring responses
- optional RA rendering support in the UI

### Validation

- [ ] Add tests for SQL-to-RA explanation cases
- [ ] Verify Hebrew explanations remain clear and course-aligned
- [ ] Verify tool does not overstep current course scope

## Sprint 7: Instructor Deep Research Mode

### Objectives

- support instructor-only research and content generation workflows
- combine trusted internal course data with OpenAI deep research tools
- keep this isolated from student-facing chat

### Todo

- [ ] Add admin route or UI for deep research jobs
- [ ] Use `o3-deep-research` or `o4-mini-deep-research`
- [ ] Support these data sources:
  - `file_search`
  - trusted connectors
  - trusted remote MCP
  - optional `web_search`
- [ ] Add `max_tool_calls` limits to control cost and latency
- [ ] Use `background: true` by default for deep research tasks
- [ ] Add prompt templates for:
  - assignment design research
  - SQL dialect comparison
  - rubric drafting
  - literature / documentation synthesis
- [ ] Add explicit guardrails against combining sensitive student data with public web search in one pass
- [ ] Consider phased workflows:
  - public research first
  - private connector / MCP second

### Deliverables

- instructor deep-research mode
- prompt templates for common instructor tasks
- safe staged workflow rules

### Validation

- [ ] Test deep research with only file search
- [ ] Test deep research with connectors
- [ ] Test deep research with background completion and webhook callback
- [ ] Verify it is not reachable from student routes

## Sprint 8: Hardening, Eval, And Rollout

### Objectives

- validate the new tool surface before broad rollout
- harden against prompt injection and unwanted data flows
- move from admin-only experiments to stable production capabilities

### Todo

- [ ] Create eval set for:
  - week-scoped retrieval
  - homework guidance
  - personalization quality
  - connector-backed deadline answers
  - web-search citation quality
- [ ] Add prompt-injection review checklist for:
  - web search
  - file search
  - remote MCP
  - connectors
- [ ] Add staged rollout by role:
  - admin
  - instructor
  - selected student cohort
- [ ] Add metrics dashboard for:
  - tool call rate
  - tool error rate
  - retrieval precision proxy
  - background job completion rate
  - average latency by tool type
- [ ] Document rollback steps for each new tool category
- [ ] Update `README.md` and operational docs

### Deliverables

- eval suite
- rollout dashboard
- rollback documentation
- production hardening notes

### Validation

- [ ] Run eval set before each rollout phase
- [ ] Verify rollback flags work
- [ ] Confirm grading and evaluation paths are still isolated from external tools

## Cross-sprint guardrails

- [ ] Only use official OpenAI connectors or trusted official MCP servers where available
- [ ] Do not expose external-data tools to grading or automated evaluation flows
- [ ] Keep student-facing answers grounded in course truth first
- [ ] Render citations clearly for file-search and web-search answers
- [ ] Log tool calls for review and debugging
- [ ] Minimize sensitive data sent to any third-party integration
- [ ] For mixed public/private research, use phased calls instead of one fully connected request

## Suggested sprint order

- [ ] Sprint 0
- [ ] Sprint 1
- [ ] Sprint 2
- [ ] Sprint 3
- [ ] Sprint 4
- [ ] Sprint 5
- [ ] Sprint 6
- [ ] Sprint 7
- [ ] Sprint 8

## Repo notes

- Michael already has custom tool infrastructure in `lib/openai/tools.ts`
- Michael already uses `file_search` in `app/api/responses/messages/route.ts`
- Michael already has vector-store management routes in `app/api/responses/files/route.ts`
- Michael already has admin-only `code_interpreter` in the tool catalog
- `list_instructor_mcp_capabilities` is the natural anchor for connector / MCP rollout

## Source references

- OpenAI latest model guide: https://developers.openai.com/api/docs/guides/latest-model/
- GPT-5 mini model page: https://developers.openai.com/api/docs/models/gpt-5-mini
- Responses API create reference: https://developers.openai.com/api/reference/resources/responses/methods/create/
- File search guide: https://developers.openai.com/api/docs/guides/tools-file-search/
- Deep research guide: https://developers.openai.com/api/docs/guides/deep-research/
- Webhooks guide: https://developers.openai.com/api/docs/guides/webhooks/
- MCP safety guidance: https://developers.openai.com/api/docs/mcp/
- MCP and connectors guide: https://developers.openai.com/api/docs/guides/tools-connectors-mcp/
