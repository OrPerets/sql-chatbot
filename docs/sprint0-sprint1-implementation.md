# Sprint 0 And Sprint 1 Implementation Notes

Updated: 2026-03-31

## Sprint 0 Deliverables

### Feature-flag plan

- `FEATURE_OPENAI_WEB_SEARCH`
  - default: `OFF`
  - scope: admin-only hosted web search
- `FEATURE_OPENAI_CONNECTORS`
  - default: `OFF`
  - scope: instructor connector and MCP rollout surfaces
- `FEATURE_RESPONSES_BACKGROUND`
  - default: `OFF`
  - scope: future background Responses jobs
- `FEATURE_PERSONALIZATION_TOOLS`
  - default: `ON`
  - scope: existing personalization tools remain available while rollout governance is added

### Rollout matrix by context

- `main_chat`
  - student-safe SQL tutoring only
  - file search allowed
  - web search blocked
- `homework_runner`
  - hint-first homework guidance
  - file search allowed
  - web search blocked
- `admin`
  - instructor diagnostics and grounded research
  - file search allowed
  - web search allowed only when `FEATURE_OPENAI_WEB_SEARCH=1`
- `voice`
  - low-latency educational assistant
  - web search blocked

### Logging plan

- Hosted-tool usage is written to structured app logs.
- Sensitive hosted-tool events are also mirrored to Mongo `audit_logs`.
- Current web-search audit payload includes:
  - route
  - context
  - role
  - response ID
  - queries
  - source count
  - latency
  - fallback vs completed status

## Sprint 1 Deliverables

- Admin-only `web_search` support lives in the shared Responses route behind `context: "admin"`.
- Admin prompt policy prefers internal course files for course truth and limits web search to fresh external questions and documentation-style lookups.
- Response parsing now captures `web_search_call` items plus citation counts and query lists.
- Admin test console now uses the shared Responses route and renders citations plus web-search diagnostics.
