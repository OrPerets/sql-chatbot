# MCP Weekly Context Function Calling Integration Plan

## Current Architecture Snapshot
- **Admin authoring UI** lives in `app/components/McpMichaelPage.tsx`, exposing semester start configuration and 14 editable week content rows that POST to `/api/mcp-michael` and `/api/mcp-michael/semester-start`.
- **Next.js API surface** proxies admin requests through `app/api/mcp-michael/*` into the canonical content endpoints at `app/api/content/weekly` and `app/api/content/semester-start`, which rely on `lib/content.ts` for Mongo persistence.
- **Assistant message pipeline** (`app/api/assistants/threads/[threadId]/messages/route.ts`) currently fetches `/api/mcp-michael/current-week` at send time and appends the returned text directly to the user prompt before invoking the Assistants API.
- **Function calling hooks** exist but are unused in production: `app/api/assistants/functions/sql/route.ts` implements mocked SQL tool handlers, and the chat UI (`app/components/chat.tsx`) already wires AssistantStream `requires_action` events into a configurable `functionCallHandler`.

## Goal
Replace the hardcoded prompt injection with an OpenAI function call (`get_course_week_context`) so Michael can fetch the correct weekly syllabus slice on demand, with fallbacks for missing data and optional overrides for historical weeks.

## Implementation Tasks

### 1. Harden the Weekly Content Data Layer
- [ ] Extend `lib/content.ts` with helpers that return `(weekNumber, content, dateRange, updatedAt, updatedBy)` for:
  - the **current** week (respecting the stored semester start date and clamping to 1–14), and
  - an **arbitrary** week override.
- [ ] Update `/api/content/weekly` GET to include metadata (e.g., `updatedAt`) when present and ensure results are sorted.
- [ ] Fix `/api/mcp-michael/current-week` to call `/api/content/semester-start?withCurrentWeek=1` by default and normalize the response shape to `{ weekNumber, content, dateRange }` so the new function has a single contract.
- [ ] Add defensive handling for missing semester start date (returning `null` content with an explanatory message) so the assistant can respond gracefully.

### 2. Expose Course Context via a Dedicated Function Endpoint
- [ ] Create `app/api/assistants/functions/course-context/route.ts` that mirrors the SQL function router pattern but supports:
  - `get_course_week_context` → returns the current week by default or a requested `week` number.
  - `list_course_week_summaries` → optional helper that returns all weeks for debugging/admin usage.
- [ ] Reuse the new helpers from `lib/content.ts` and include provenance fields (`updatedAt`, `updatedBy`) and ISO timestamps in the JSON payload so the assistant can cite sources.
- [ ] Standardize the response schema and make sure it is JSON-stringified before streaming back to OpenAI (the Assistants API expects string tool outputs).
- [ ] Log errors with enough context (requested week, semester start) without leaking sensitive data.

### 3. Register the Function on the Assistant Configuration
- [ ] Update both assistant bootstrap routes (`app/api/assistants/route.ts` for creation and `app/api/assistants/update/route.ts` for upgrades) to include a new tool definition:
  ```ts
  {
    type: "function",
    function: {
      name: "get_course_week_context",
      description: "Fetch the syllabus focus for the current or requested week to ground tutoring responses.",
      parameters: {
        type: "object",
        properties: {
          week: {
            type: "integer",
            minimum: 1,
            maximum: 14,
            description: "Optional explicit week number; omit to use the current academic week."
          }
        }
      }
    }
  }
  ```
- [ ] (Optional) Register `list_course_week_summaries` if implemented for meta questions.
- [ ] Document in the assistant instructions that weekly context should be pulled via the new function rather than assuming prior injection.
- [ ] Run the `/api/assistants/update` endpoint (or redeploy) so the production assistant picks up the new tool.

### 4. Wire the Chat Client to Fulfill Tool Calls
- [ ] In `app/components/EnhancedChatWithAvatar.tsx`, pass a real `functionCallHandler` prop into `<Chat />`. The handler should:
  - Inspect `call.function.name` and forward recognized functions to a new frontend helper (e.g., `fetchCourseContextToolOutput`) that POSTs to `/api/assistants/functions/course-context`.
  - Delegate existing SQL tool names to their respective API (`/api/assistants/functions/sql`). Consider extracting a shared dispatcher so both SQL and course context tools can coexist.
  - Return the raw JSON string from the API to satisfy AssistantStream requirements.
- [ ] Ensure the handler keeps the UI disabled (`setInputDisabled(true)`) until tool outputs are submitted; the existing `handleRequiresAction` flow already handles this once the promise resolves.
- [ ] Remove or behind-flag the manual prompt concatenation in `app/api/assistants/threads/[threadId]/messages/route.ts` to avoid duplicate context. Retain a fallback (e.g., only append if `process.env.MCP_FORCE_PROMPT_CONTEXT === '1'`) during rollout.

### 5. Validate in Admin & Assistant Flows
- [ ] Update `app/components/McpMichaelPage.tsx` to surface the last-saved timestamp and the effective current week so admins can verify the data the assistant will retrieve.
- [ ] Add a lightweight “Preview assistant context” button that calls the new function endpoint and displays the JSON, helping QA confirm the response matches expectations.

### 6. Testing & QA
- [ ] Extend `__tests__/mcp-michael.test.ts` with unit tests for:
  - `get_course_week_context` happy path, empty content, and out-of-range weeks.
  - Response formatting (Hebrew text preserved, bracketed context removed because the assistant will format it).
- [ ] Add an integration test for `app/api/assistants/functions/course-context/route.ts` that stubs Mongo and verifies the JSON payload.
- [ ] Update `app/api/assistants/test/route.ts` to add a new test type (e.g., `"course_context"`) that triggers the function call via `function_calling` and asserts `required_action` was completed.
- [ ] Run `npm test` and `npm run lint` locally before opening a PR.

### 7. Deployment & Monitoring
- [ ] Confirm environment variables (`NEXT_PUBLIC_APP_URL`, `MONGODB_URI`, `OPENAI_API_KEY`) are set in every environment where the assistant runs.
- [ ] Add structured logging around the new function so Datadog/console dashboards can track frequency and failures.
- [ ] Consider recording the last delivered context blob (week number + hash) inside the chat session metadata for auditing.

## Validation Checklist
- [ ] Assistant messages referencing weekly material include explicit citations from the function payload.
- [ ] No duplicate weekly context text appears in the final assistant reply.
- [ ] Admin edits propagate to the assistant within a single request (no caching issues).
- [ ] Function calls resolve within acceptable latency (<1s) thanks to Mongo retries.

## Open Questions / Follow-ups
1. Should the function return richer structured fields (e.g., `topics`, `assignments`, `reading`) beyond the single `content` string? If so, extend the admin UI schema.
2. Do we need per-course or per-section segmentation? The current tables are global; multi-course support would require additional filters.
3. How should the assistant behave when multiple weeks overlap (e.g., midterms)? Consider allowing multi-week context aggregation in the function signature later.
