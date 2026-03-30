# Michael OpenAI and Product Refinement Backlog

## Architecture status

- Michael is now treated as a Responses-first product.
- `/api/assistants/*` remains available as a deprecated compatibility layer for one release cycle.
- Production voice mode is `chained`.
- Direct Realtime voice is `realtime_experimental` only and must remain opt-in.
- Non-production tools must stay hidden from Michael until they are backed by real product-safe behavior.

## Sprint 1: Source of truth and docs alignment

### Completed in this pass

- [x] Replace stale repo defaults so docs and env examples no longer recommend `gpt-4.1-mini`.
- [x] Update README and runtime docs to describe Responses-first operation.
- [x] Document canonical runtime endpoints under `/api/responses/runtime*`.
- [x] Refresh the local `openai-docs` helper model map to the GPT-5.4 family used by this project plan.
- [x] Add `openai-docs` review references for Responses audits, app audits, and Realtime/voice doc drift.
- [x] Clarify historical docs so old `assistants` defaults are preserved as history, not as current guidance.

### Follow-up tasks

- [ ] Add a short “OpenAI architecture” page that links model registry, voice config, runtime endpoints, and tool catalog in one place.
- [ ] Add explicit release notes for the Assistants-route deprecation window.
- [ ] Review any remaining internal runbooks or admin docs outside `docs/` for stale model or mode language.

## Sprint 2: Responses contract cleanup and model centralization

### Completed in this pass

- [x] Introduce a shared OpenAI model registry in `lib/openai/model-registry.ts`.
- [x] Move tutor-chat defaults to `gpt-5.4-mini`.
- [x] Move admin/evaluation flows to `gpt-5.4` where they were previously hardcoded to older models.
- [x] Add canonical runtime config endpoints:
  - [x] `GET|POST /api/responses/runtime`
  - [x] `GET|POST /api/responses/runtime/validate`
  - [x] `GET|POST|PATCH /api/responses/runtime/rollback`
- [x] Rewire legacy `/api/assistants/update|test|rollback` routes to the shared runtime-management layer.
- [x] Add explicit deprecated-alias logging for legacy runtime-management routes.
- [x] Switch admin runtime-management UI to the canonical Responses runtime endpoints.

### Follow-up tasks

- [ ] Add a dedicated API test suite that verifies canonical Responses runtime routes and legacy Assistants aliases return equivalent payloads.
- [ ] Centralize any remaining OpenAI model choices in secondary services that still use separate defaults.
- [ ] Decide whether compatibility rollback to `assistants` should remain supported after the next release cycle.

## Sprint 3: Michael capability hardening

### Completed in this pass

- [x] Replace ad hoc tool exposure with a typed tool catalog that marks tools as `production`, `experimental`, or `disabled`.
- [x] Hide non-production tools from Michael’s default chat/runtime configuration.
- [x] Disable `get_weather` completely as out-of-scope.
- [x] Upgrade `get_database_schema` from fake static output to real product data sources:
  - [x] curated examples schema
  - [x] practice-table metadata
- [x] Replace `execute_sql_query` fake sample output with a constrained examples-only execution path and explicit refusal for unsupported contexts.
- [x] Replace canned performance analysis with heuristic educational analysis and mark it non-production.

### Follow-up tasks

- [ ] Add a scoped execution context for homework/student-specific SQL execution before exposing `execute_sql_query` in production.
- [ ] Add richer schema retrieval for homework contexts using active assignment/student context.
- [ ] Add tool-eligibility rules by product state, not just by broad context label.
- [ ] Add acceptance tests for file-search retrieval quality, missing vector store handling, and tool-loop recovery.
- [ ] Build a reusable eval set for bilingual tutoring, schema help, SQL debugging, retrieval grounding, and malformed tool inputs.

## Sprint 4: Voice, UX, and product coherence

### Completed in this pass

- [x] Introduce a typed voice runtime contract in `lib/openai/voice-config.ts`.
- [x] Convert the voice runtime endpoint from preview-model strings to a structured production/experimental contract.
- [x] Rewire the client voice service to load backend voice config instead of embedding preview assumptions.
- [x] Update transcription and TTS routes to use shared voice-model defaults instead of `whisper-1` and `tts-1` hardcodes.
- [x] Make the current production voice posture explicit: chained by default, Realtime experimental.

### Follow-up tasks

- [ ] Implement backend-issued GA Realtime ephemeral credentials if `realtime_experimental` is enabled.
- [ ] Refactor the main chat client into smaller presentation/state modules.
- [ ] Run a focused UX audit before changing layout, hierarchy, iconography, or onboarding.
- [ ] Add telemetry for chat latency, tool failures, retrieval failures, voice-session failures, and admin model-change events.
- [ ] Decide how voice mode should expose schema/retrieval affordances without overloading the main chat UI.

## Test backlog

### Completed in this pass

- [x] Update test targets and docs planning so new runtime surfaces are explicit.

### Remaining

- [ ] Add unit tests for:
  - [ ] model registry
  - [ ] voice config
  - [ ] tool catalog filtering
- [ ] Update existing runtime-config and Responses tests to use the shared registry defaults.
- [ ] Add API tests for canonical runtime routes and deprecated aliases.
- [ ] Add integration coverage for multi-turn Responses continuity with `previous_response_id`.
- [ ] Add voice-route tests that verify chained-mode defaults and experimental-mode gating.

## Release gate

- [ ] No repo docs or admin copy recommend stale model defaults.
- [ ] No preview-era Realtime model strings remain in production voice paths.
- [ ] Michael default chat only exposes production-safe tools.
- [ ] Canonical `/api/responses/runtime*` routes are covered by tests.
- [ ] Assistants compatibility routes are documented as temporary and deprecated.
