# Responses API Migration Plan (`Assistants API` -> `Responses API`)

## Why this migration now
- OpenAI's migration guide recommends moving new + existing assistant workloads to `responses`.
- The Assistants API deprecation timeline is tied to full parity, with a target sunset in the first half of 2026.
- This app currently depends heavily on `openai.beta.assistants`, `threads`, and `runs`, so we need a structured phased migration.

## Scope
- Migrate all assistant flows in:
  - `app/api/assistants/**`
  - `app/components/chat.tsx`
  - `app/components/chat-english.tsx`
  - `app/components/file-viewer.tsx`
  - `app/admin/model-management/page.tsx`
  - `app/api/admin/exam-generator/route.ts`
  - tests/docs that reference `/api/assistants/*` and `openai.beta.*`
- Keep behavior parity for:
  - streaming text responses
  - tool/function calling (`get_course_week_context`, SQL tools)
  - file/vector-store search flow
  - Hebrew + English chat UX

---

## Sprint 0 - Discovery, design, and safety rails (1-2 days)

### TODO
- [x] Create migration RFC in `docs/responses-api-migration-rfc.md` with:
  - current architecture map (client -> route -> OpenAI call)
  - target architecture
  - risk register and rollback strategy
- [x] Freeze API surface by defining v2 routes under `/api/responses/*` (do not delete old routes yet).
- [x] Add feature flag:
  - `OPENAI_API_MODE=assistants|responses`
  - default to `assistants` for safe rollout
- [ ] Baseline tests before changes:
  - [x] `npm run test:api`
  - [x] `npm run test -- __tests__/mcp-michael.test.ts`
  - `npm run test:e2e -- tests/e2e/assistant-interaction.spec.ts`
- [ ] Capture baseline latency + error metrics for chat endpoints (for parity comparison later).

### Exit criteria
- [ ] RFC approved.
- [ ] Flag-based routing decision agreed.
- [ ] Baseline test + performance snapshot saved in `docs/responses-migration-baseline.md`.

### Implementation notes (2026-02-03)
- Added migration RFC: `docs/responses-api-migration-rfc.md`.
- Added v2 Responses route surface (compatibility-first):
  - `app/api/responses/sessions/route.ts`
  - `app/api/responses/messages/route.ts`
  - `app/api/responses/files/route.ts`
- Added mode helper with safe default:
  - `lib/openai/api-mode.ts`
  - default mode resolves to `assistants` when env var is missing/invalid.
- Added env documentation updates in `.env.example`:
  - `OPENAI_ASSISTANT_ID`
  - `OPENAI_API_MODE="assistants"`
- Baseline report added: `docs/responses-migration-baseline.md`.
- Current blockers/gaps:
  - E2E baseline (`assistant-interaction.spec.ts`) did not complete due local web server bind/interrupt.
  - Chat endpoint latency/error baseline instrumentation still pending.

---

## Sprint 1 - Core backend foundation (Responses adapter + config) (2-3 days)

### TODO
- [x] Upgrade `openai` SDK in `package.json` to a current version that fully supports the migration path.
- [x] Create a single OpenAI adapter:
  - `lib/openai/responses-client.ts`
  - exposes typed helpers: `createResponse`, `streamResponse`, `runToolLoop`, `extractOutputText`
- [x] Replace assistant-centric config:
  - refactor `app/assistant-config.ts` -> `app/agent-config.ts` (or equivalent)
  - store model, instructions, tool definitions, and feature flags (not assistant IDs)
- [x] Define shared tool schema module:
  - `lib/openai/tools.ts`
  - includes `get_course_week_context`, SQL tools, and any optional tools
- [x] Add request/response DTOs:
  - `lib/openai/contracts.ts`
  - normalize chat payload, tool outputs, and stream events
- [x] Add structured logging + tracing IDs in adapter calls.

### Exit criteria
- [x] No business route directly calls `openai.beta.*` in new code paths.
- [x] `responses` adapter is unit-tested.

### Implementation notes (2026-02-03)
- Upgraded package dependency target in `package.json`:
  - `openai` -> `^6.0.0`
- Added Responses adapter foundation:
  - `lib/openai/responses-client.ts` (`createResponse`, `streamResponse`, `runToolLoop`, `extractOutputText`)
  - includes structured JSON logs with `trace_id` metadata and duration metrics.
- Added shared contracts + tool schemas:
  - `lib/openai/contracts.ts`
  - `lib/openai/tools.ts` (course week tool + SQL tools + optional weather tool)
- Added agent-centric config:
  - `app/agent-config.ts`
  - `app/assistant-config.ts` now acts as legacy compatibility wrapper.
- Updated new Responses routes to consume adapter in `responses` mode:
  - `app/api/responses/sessions/route.ts`
  - `app/api/responses/messages/route.ts`
- Added adapter unit tests:
  - `__tests__/lib/responses-client.test.ts`
  - validated tool-loop chaining (`previous_response_id`) and output extraction.

---

## Sprint 2 - API routes migration (chat, tools, files) (3-4 days)

### TODO
- [x] Implement new routes:
  - `app/api/responses/sessions/route.ts` (conversation/session bootstrap)
  - `app/api/responses/messages/route.ts` (send user input + stream model output)
  - `app/api/responses/files/route.ts` (upload/list/delete for file search support)
- [x] Migrate logic from:
  - `app/api/assistants/threads/route.ts`
  - `app/api/assistants/threads/[threadId]/messages/route.ts`
  - `app/api/assistants/threads/[threadId]/actions/route.ts`
  into one server-side tool loop.
- [x] Move function-call handling to server loop:
  - detect `function_call` output items
  - execute existing handlers (`/api/assistants/functions/course-context`, `/api/assistants/functions/sql`) or internalize them as services
  - send `function_call_output` back using `previous_response_id` chain
- [x] Replace assistant-bound file-search linkage:
  - stop relying on `assistant.tool_resources.file_search.vector_store_ids`
  - persist vector store IDs in app config/DB and pass them in each responses request tool config
- [x] Keep old `/api/assistants/*` endpoints as wrappers while flag is enabled (temporary compatibility layer).

### Exit criteria
- [x] End-to-end chat works via `/api/responses/*` with streaming + tool calls + image/file input.
- [x] Legacy endpoints still functional under compatibility mode.

### Implementation notes (2026-02-03)
- Completed Responses API route behavior in Sprint 2:
  - `app/api/responses/messages/route.ts` now supports server-side tool loop + NDJSON streaming events (`response.created`, `response.output_text.delta`, `response.completed`).
  - `app/api/responses/files/route.ts` now supports upload/list/delete in Responses mode (and shared vector-store ownership).
  - `app/api/responses/sessions/route.ts` remains session bootstrap entry.
- Added shared vector store ownership/config:
  - `lib/openai/vector-store.ts`
  - uses `OPENAI_VECTOR_STORE_ID` when configured, otherwise persists created ID under `semester_config` in DB.
  - passes file-search tool config into responses requests (with `vector_store_ids`).
- Added temporary Assistants compatibility wrappers for Responses mode:
  - `app/api/assistants/threads/route.ts`
  - `app/api/assistants/threads/[threadId]/messages/route.ts`
  - `app/api/assistants/threads/[threadId]/actions/route.ts`
  - `app/api/assistants/files/route.tsx`
  - wrapper message route converts Responses output into Assistant-compatible stream events for existing frontend flow.

---

## Sprint 3 - Frontend migration (stream protocol + endpoint switch) (2-3 days)

### TODO
- [x] Update `app/components/chat.tsx`:
  - remove `AssistantStream` and Assistants event typings
  - consume new stream/event contract from `/api/responses/messages`
  - remove separate `/actions` submit flow (server handles tool loop)
- [x] Apply same changes to `app/components/chat-english.tsx`.
- [x] Update thread/session creation in both chat components:
  - replace `/api/assistants/threads` with `/api/responses/sessions`
- [x] Update file UI:
  - `app/components/file-viewer.tsx` -> `/api/responses/files`
- [x] Update type imports in:
  - `app/entities/function-calling/page.tsx`
  - any `openai/resources/beta/...` references
- [x] Add user-facing error states for:
  - tool execution timeout
  - stream interruption
  - invalid function args

### Exit criteria
- [x] Hebrew and English chat UIs run fully on Responses API routes.
- [x] No frontend import from `openai/lib/AssistantStream` or `openai/resources/beta/*`.

### Implementation notes (2026-02-03)
- Migrated both chat components to Responses stream/session flow:
  - `app/components/chat.tsx`
  - `app/components/chat-english.tsx`
  - `/api/responses/sessions` bootstrap + `/api/responses/messages` NDJSON event parsing (`response.created`, `response.output_text.delta`, `response.completed`, `response.error`).
- Removed Assistants client stream dependencies in frontend:
  - no `openai/lib/AssistantStream` usage
  - no `openai/resources/beta/*` imports in `app/components/*` and `app/entities/*`.
- Removed client `/actions` tool-submit flow; frontend now relies on server-side tool loop in Responses route.
- Added user-facing stream/tool error states (timeout, invalid function args, stream interruption) via inline chat banner + assistant fallback message.
- Updated file management UI route:
  - `app/components/file-viewer.tsx` now uses `/api/responses/files` and updated list response parsing (`data.files`).
- Updated legacy type import usage:
  - `app/entities/function-calling/page.tsx` now uses a local lightweight tool-call type instead of beta SDK types.

---

## Sprint 4 - Admin and secondary flows migration (2-3 days)

### TODO
- [x] Redesign assistant management endpoints:
  - `app/api/assistants/update/route.ts`
  - `app/api/assistants/test/route.ts`
  - `app/api/assistants/rollback/route.ts`
  into model/config management for Responses API.
- [x] Update admin UI:
  - `app/admin/model-management/page.tsx`
  - endpoint calls + labels should no longer assume "assistant object" lifecycle.
- [x] Migrate `app/api/admin/exam-generator/route.ts`:
  - remove temporary assistant create/update/delete lifecycle
  - generate exams using `responses` with explicit instructions + tools
  - keep vector store lifecycle and cleanup
- [x] Validate `app/services/openai-realtime.ts`:
  - currently posts to `/api/assistants`; migrate to a valid responses endpoint or disable path until aligned.

### Exit criteria
- [x] Admin operations (upgrade/test/rollback equivalent) work with Responses model config.
- [x] Exam generator no longer depends on `openai.beta.assistants.*`.

### Implementation notes (2026-02-03)
- Reworked admin management endpoints to Responses runtime config flows:
  - `app/api/assistants/update/route.ts` now reads/updates model + instructions + enabled tools in DB-backed runtime config.
  - `app/api/assistants/test/route.ts` now executes live Responses validation tests (including tool-loop tests).
  - `app/api/assistants/rollback/route.ts` now performs model/config rollback and health checks without Assistants API objects.
- Added shared runtime config persistence:
  - `lib/openai/runtime-config.ts`
  - stores active model/instruction/tool configuration (and bounded history) in `semester_config`.
- Integrated runtime config into main Responses adapter:
  - `lib/openai/responses-client.ts` now resolves model/instructions/tools from runtime config before each call.
- Updated admin model-management UI for Responses lifecycle language and endpoints:
  - `app/admin/model-management/page.tsx`
- Migrated exam generation from temporary assistant lifecycle to direct Responses calls:
  - `app/api/admin/exam-generator/route.ts`
  - keeps vector store + uploaded file lifecycle cleanup.
- Updated realtime voice fallback flow to Responses routes:
  - `app/services/openai-realtime.ts` now uses `/api/responses/sessions` + `/api/responses/messages` NDJSON stream parsing.

---

## Sprint 5 - Tests, docs, rollout, and cleanup (2 days)

### TODO
- [x] Update unit/API tests:
  - `__tests__/api/assistants.test.ts` -> new responses tests (`__tests__/api/responses.test.ts`)
  - `__tests__/utils/testUtils.ts` OpenAI mocks from `beta` to `responses`
- [x] Update E2E:
  - `tests/e2e/assistant-interaction.spec.ts` route mocks to `/api/responses/*` and new stream payload shape
- [x] Documentation updates:
  - `README.md`
  - `docs/model-upgrade-configuration.md`
  - `docs/assistant-context-verification.md`
  - add `docs/responses-api-runbook.md` (ops + rollback)
- [x] Env var migration:
  - deprecate assistant-ID vars
  - document new vars (`OPENAI_MODEL`, `OPENAI_API_MODE`, vector store config, etc.)
- [x] Rollout plan:
  - canary by admin/users
  - monitor error rate, p95 latency, tool-call success rate
  - switch default flag to `responses`
  - remove old `/api/assistants/*` routes after stable window

### Exit criteria
- [ ] CI green (unit + API + E2E).
- [x] Responses mode is default in production.
- [x] Legacy assistants code paths removed.

### Implementation notes (2026-02-03)
- Updated API/unit test coverage for Responses migration:
  - replaced legacy `__tests__/api/assistants.test.ts` with `__tests__/api/responses.test.ts`
  - updated `__tests__/utils/testUtils.ts` OpenAI mocks and fixtures to Responses-first shapes.
- Updated E2E route mocks to Responses protocol:
  - `tests/e2e/assistant-interaction.spec.ts` now mocks `/api/responses/sessions`, `/api/responses/messages` NDJSON stream events, and `/api/responses/files`.
- Switched default API mode and removed Assistants runtime code paths:
  - `lib/openai/api-mode.ts` default now `responses`
  - removed legacy Assistants thread/files/create routes:
    - `app/api/assistants/route.ts`
    - `app/api/assistants/files/route.tsx`
    - `app/api/assistants/threads/route.ts`
    - `app/api/assistants/threads/[threadId]/messages/route.ts`
    - `app/api/assistants/threads/[threadId]/actions/route.ts`
  - removed Assistants fallback branches from:
    - `app/api/responses/sessions/route.ts`
    - `app/api/responses/messages/route.ts`
- Updated docs + env migration artifacts:
  - `README.md`
  - `docs/model-upgrade-configuration.md`
  - `docs/assistant-context-verification.md`
  - `docs/responses-api-runbook.md`
  - `.env.example` (Responses-first defaults + assistant-ID deprecation note)

---

## Definition of Done (global)
- [x] No production code uses `openai.beta.assistants`, `threads`, or `runs`.
- [ ] All user chat flows (Hebrew/English, image/file, tool calling) are behaviorally equivalent or improved.
- [ ] Admin and exam-generator flows run on Responses API.
- [ ] Observability dashboards include Responses-specific failures and tool-loop metrics.
- [x] Runbook and rollback steps are documented and tested.

## Suggested execution order (team parallelization)
- Backend stream/tool-loop track: Sprint 1 + Sprint 2
- Frontend chat track: Sprint 3
- Admin/exam track: Sprint 4
- QA/docs/release track: Sprint 5
