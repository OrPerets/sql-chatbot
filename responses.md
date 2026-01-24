# Responses API Migration Plan

## Overview
The Assistants API is deprecated and will be removed in August 2026, so this app must be fully migrated to the Responses API. The goal is to preserve Michael’s behavior (persona, safety, SQL curriculum constraints), end-to-end tool calling (MCP-style functions), streaming UI, and file search. This plan breaks the work into sprints with clear deliverables and checklists.

## Goals
- Replace all Assistants API usage with Responses API calls.
- Maintain Michael’s persona and weekly context injection.
- Preserve tool calling flow (course context + SQL tools) end-to-end.
- Keep streaming UX parity (incremental assistant output + tool call handling).
- Keep file search/vector store behavior working via Responses API.
- Update docs/tests to reflect the new API.

## Non-Goals
- Redesigning the UI or rewriting unrelated features.
- Changing product requirements or curriculum logic.
- Reworking analytics beyond what’s required for API switch.

## Current Architecture Summary (What we must preserve)
- **Chat flow**: client creates thread → sends message → server streams assistant run output. Tool calls are handled by client via function endpoints, then submitted back to run.
- **Weekly context**: server injects current week context into the user message before sending to the model.
- **Tooling**:
  - `get_course_week_context`, `list_course_week_summaries` (course-context endpoint)
  - `execute_sql_query`, `get_database_schema`, `analyze_query_performance` (sql endpoint)
- **Persona**: “Michael” with curriculum-aware constraints.
- **File handling**: assistant vector store + file search for knowledge retrieval.

## Target Architecture Summary (Responses API)
- **Single Responses stream endpoint** that:
  - Accepts user input + optional image
  - Injects weekly context on the server
  - Calls the Responses API with:
    - model
    - system instructions (Michael)
    - tools (course context, SQL)
    - tool resources (file search vector store ids)
  - Streams output to the UI
  - Handles tool calls server-side and feeds tool outputs back into the stream
- **Client** only renders stream and user messages (no tool dispatch).
- **Centralized tool schema + dispatcher** shared by server code.
- **Config**: move from assistant-id-based config to per-request model/instruction config.

---

# Sprint Plan

## Sprint 1 — Foundations & Streaming Endpoint
**Objective:** Introduce a Responses-based server stream endpoint and keep the UI working with minimal changes.

### Tasks
1. **Create a Responses stream API route**
   - Add a new route or refactor `/api/assistants/threads/[threadId]/messages` to use Responses API.
   - Keep weekly context injection before building the input messages.
   - Decide how to store conversation history (client sends history OR server stores by threadId).

2. **Model/config abstraction**
   - Create a new config module exporting:
     - `model` (e.g. `gpt-4.1-mini` or newer)
     - `systemInstructions` (Michael’s persona)
     - `toolsEnabled` flags

3. **Minimal UI wiring**
   - Update the client to call the new endpoint and render streamed tokens.
   - Keep existing UI events intact, but map the Responses stream events to UI handlers.

### Sprint 1 Todo Checklist
- [ ] Implement Responses stream endpoint
- [ ] Preserve weekly context injection server-side
- [ ] Provide basic streaming output to client
- [ ] Add config module for model + instructions
- [ ] Update client to consume Responses stream

### Acceptance Criteria
- Chat messages stream back in the UI.
- Michael persona and weekly context are still applied.
- No tool calls yet (tools can be stubbed for Sprint 1).

---

## Sprint 2 — Tooling & MCP-Style Function Calls
**Objective:** Rebuild tool calling fully server-side with Responses API tools.

### Tasks
1. **Tool schema definitions**
   - Create a shared tool schema file defining:
     - `get_course_week_context`
     - `list_course_week_summaries`
     - `execute_sql_query`
     - `get_database_schema`
     - `analyze_query_performance`

2. **Tool dispatcher**
   - Build a server-side dispatcher that routes tool calls to existing endpoints or shared logic.

3. **Server-side tool loop**
   - When Responses emits tool calls, run dispatcher and send outputs back.

4. **Remove client tool dispatch**
   - Remove function call handling in `EnhancedChatWithAvatar` and other components.

### Sprint 2 Todo Checklist
- [ ] Shared tool schema module
- [ ] Tool dispatcher implemented server-side
- [ ] Responses tool call loop handled in server stream
- [ ] Client tool dispatch removed

### Acceptance Criteria
- Michael calls tools successfully.
- SQL functions and course context are returned correctly.
- UI shows correct assistant responses after tool calls.

---

## Sprint 3 — File Search + Vector Store Migration
**Objective:** Move assistant file handling to Responses-compatible vector store usage.

### Tasks
1. **Vector store config**
   - Store vector store IDs in config/env or DB.
   - Remove assistant update logic tied to vector stores.

2. **Update file endpoints**
   - Update file upload/list/delete endpoints to use the stored vector store.

3. **Inject file_search into Responses request**
   - Add `tool_resources` with vector store IDs in Responses API call.

### Sprint 3 Todo Checklist
- [ ] Vector store ID persistence
- [ ] File endpoints updated
- [ ] Responses requests include file_search resources

### Acceptance Criteria
- Files can be uploaded and retrieved as before.
- Assistant can use file_search for responses.

---

## Sprint 4 — Admin, Docs, Tests, Cleanup
**Objective:** Align docs/tests/admin pages with Responses and remove Assistants API usage.

### Tasks
1. **Admin UI update**
   - Update model management page to display model + instructions instead of assistant ID.

2. **Docs refresh**
   - Update assistant context verification docs for Responses.
   - Update model upgrade configuration docs for Responses.

3. **Tests update**
   - Update e2e tests to mock Responses endpoints and stream events.

4. **Remove unused Assistants API code**
   - Delete or deprecate `assistants` routes not used post-migration.

### Sprint 4 Todo Checklist
- [ ] Admin UI updated
- [ ] Documentation updated
- [ ] Tests updated
- [ ] Assistants API code removed

### Acceptance Criteria
- Docs/tests match the new implementation.
- No runtime dependency on Assistants API remains.

---

# Risks & Mitigations
- **Streaming event mismatch** → Build a mapping layer between Responses events and existing UI logic.
- **Tool call parity** → Implement a thorough dispatcher and add logging for tool calls.
- **Conversation history** → Use DB session storage or pass history from client if needed.

---

# Deliverables
- New Responses-based API endpoints for streaming chat.
- Updated UI handling Responses streaming events.
- Server-side tool calling flow.
- Updated file search integration.
- Updated admin/config/docs/tests.

---

# Notes
- This plan preserves existing weekly context logic and Michael’s persona.
- It avoids re-architecting beyond what’s required to migrate APIs.
