# ADR-0001: OpenAI Integration Strategy for Michael

- **Status:** Accepted
- **Date:** 2026-04-01
- **Owner:** Platform Engineering

## Context

Sprint 0 requires a durable OpenAI integration approach across synchronous tutoring, asynchronous processing, tool invocation, and fallbacks. We also need a single decision source for product + engineering review.

## Decision

### 1) Primary request path (sync chat)
- Use the Responses API via `/api/responses/messages`.
- Keep canonical turn state with `previous_response_id`.
- Persist turn metadata (latency, tools, token usage, model, fallback status).

### 2) Async path (background + batch)
- Use Responses `background` mode for long-running user-triggered work.
- Reserve Batch workflows for non-urgent nightly operations (analytics/regeneration).
- Reuse shared runtime config and tool constraints for both sync and async paths.

### 3) Tool invocation strategy (direct tools + remote MCP)
- Prefer local function tools for student-facing low-latency needs.
- Allow connector/MCP tools for instructor/admin routes only.
- Keep tool availability bounded by context + role + feature flags.

### 4) Failure domains and fallback order
1. Retry recoverable API errors.
2. If `previous_response_id` fails, retry with fallback input.
3. If reasoning summary fails, continue with reasoning summary disabled.
4. If admin web search fails, continue without web search and mark fallback.
5. Return constrained error response only after fallbacks are exhausted.

## Consequences

### Positive
- Clear sync/async split with bounded failure behavior.
- Better operational visibility and safer feature rollout.
- Reusable tool policy across student/admin surfaces.

### Tradeoffs
- More metadata plumbing in request handlers.
- Requires ongoing model-cost table maintenance for estimate accuracy.

## Review checklist
- [x] Product reviewed contract fields and rollout flags.
- [x] Engineering reviewed fallback order and observability requirements.
