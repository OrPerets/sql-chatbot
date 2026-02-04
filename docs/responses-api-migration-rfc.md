# Responses API Migration RFC

## Status
- **Owner:** Platform team
- **Date:** 2026-02-03
- **Phase:** Sprint 0 (discovery + safety rails)
- **Decision:** Keep production default on Assistants API until Responses parity gates pass.

## Goals
- Introduce a stable v2 route surface under `/api/responses/*`.
- Add a runtime mode flag (`OPENAI_API_MODE`) to control rollout.
- Minimize regression risk by preserving legacy routes and behavior during migration.

## Non-goals (Sprint 0)
- Full replacement of `openai.beta.assistants.*`.
- Frontend endpoint switch.
- Full server tool-loop rewrite.

## Current Architecture (as-is)
- **Client**
  - `app/components/chat.tsx` and `app/components/chat-english.tsx` call:
    - `POST /api/assistants/threads`
    - `POST /api/assistants/threads/:threadId/messages` (stream)
    - `POST /api/assistants/threads/:threadId/actions` (tool outputs)
  - `app/components/file-viewer.tsx` calls `/api/assistants/files`.
- **Server routes**
  - `app/api/assistants/threads/route.ts` creates thread.
  - `app/api/assistants/threads/[threadId]/messages/route.ts` sends message + starts run stream.
  - `app/api/assistants/threads/[threadId]/actions/route.ts` submits tool outputs.
  - `app/api/assistants/files/route.tsx` manages files + vector store mapping.
- **OpenAI integration**
  - Direct calls to `openai.beta.threads.*`, `openai.beta.runs.*`, `openai.beta.assistants.*`.
  - Assistant identity managed via `app/assistant-config.ts`.

## Target Architecture (incremental)
- **Route layer**
  - `/api/responses/sessions` for conversation bootstrap.
  - `/api/responses/messages` for message + model stream.
  - `/api/responses/files` for file/vector support.
- **Mode switch**
  - `OPENAI_API_MODE=assistants|responses` (default `assistants`).
  - Old `/api/assistants/*` remains active as compatibility layer until cutover.
- **Future adapter (Sprint 1+)**
  - Shared Responses client adapter and tool loop.
  - Unified stream contract to frontend.

## Rollout / Flag Strategy
- `assistants` mode (default):
  - `/api/responses/*` endpoints operate in compatibility mode or return explicit `501` when not yet implemented.
  - Existing clients continue using `/api/assistants/*`.
- `responses` mode:
  - Sprint 0 routes intentionally return explicit `501` for unsupported behavior to prevent silent regressions.

## Risk Register
1. **Streaming protocol mismatch**  
   - Risk: frontend expects `AssistantStream` events.  
   - Mitigation: keep frontend on legacy routes until Sprint 3 stream contract migration.
2. **Tool-call execution regressions**  
   - Risk: function-call flow currently split between message and actions endpoints.  
   - Mitigation: delay server-side loop rewrite to Sprint 2; add parity tests before switching default mode.
3. **Vector store ownership coupling**  
   - Risk: files are currently linked through assistant `tool_resources`.  
   - Mitigation: maintain current behavior in Assistants mode; move to app-owned config in Sprint 2.
4. **Operational visibility gap**  
   - Risk: no direct parity signal during migration.  
   - Mitigation: baseline doc + follow-up p95/error metrics collection per route.
5. **Rollback complexity**  
   - Risk: mixed-mode bugs during rollout.  
   - Mitigation: single env flag rollback (`OPENAI_API_MODE=assistants`) with no schema changes in Sprint 0.

## Rollback Plan
- Immediate rollback path: set `OPENAI_API_MODE=assistants` and redeploy.
- Keep `/api/assistants/*` unchanged during Sprint 0–3 to guarantee fast fallback.
- Do not remove assistant IDs/env vars until Sprint 5 completion criteria are met.

## Acceptance Gates for Ending Sprint 0
- v2 responses route surface exists.
- Mode flag exists with safe default.
- Baseline results saved in `docs/responses-migration-baseline.md`.
