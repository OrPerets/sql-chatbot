# Responses Migration Baseline Snapshot

## Snapshot metadata
- **Date:** 2026-02-03
- **Scope:** Sprint 0 baseline before Responses API cutover
- **Mode default:** `OPENAI_API_MODE=assistants`

## Baseline test commands
- `npm run test:api`
  - Result: **PASS**
  - Suites: 12 passed
  - Tests: 75 passed, 2 skipped
  - Wall time: ~2.94s
- `npm run test -- __tests__/mcp-michael.test.ts`
  - Result: **PASS**
  - Suites: 1 passed
  - Tests: 11 passed
  - Wall time: ~0.80s
- `npm run test:e2e -- tests/e2e/assistant-interaction.spec.ts`
  - Result: **NOT COMPLETED**
  - First attempt in sandbox failed to bind `0.0.0.0:3000` (`listen EPERM`).
  - Escalated rerun was user-interrupted before completion.

## Chat endpoint performance baseline
- Dedicated latency/error baseline for chat endpoints is **not yet captured** in Sprint 0.
- Existing observability in repo is focused on security and admin metrics, not `/api/assistants/*` chat p95/error snapshots.
- Follow-up needed: add per-endpoint timers/error counters and capture a stable baseline run for:
  - `/api/assistants/threads`
  - `/api/assistants/threads/[threadId]/messages`
  - `/api/assistants/threads/[threadId]/actions`

## Implemented Sprint 0 safety rails
- Added v2 route surface:
  - `app/api/responses/sessions/route.ts`
  - `app/api/responses/messages/route.ts`
  - `app/api/responses/files/route.ts`
- Added API mode flag helper:
  - `lib/openai/api-mode.ts`
- Added env defaults:
  - `.env.example` includes `OPENAI_API_MODE="assistants"` and `OPENAI_ASSISTANT_ID`.
