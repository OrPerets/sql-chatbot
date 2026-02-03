# Responses API Runbook

## Purpose

Operational guide for rollout, monitoring, and rollback of the Responses API chat stack.

## Required config

- `OPENAI_API_MODE=responses`
- `OPENAI_MODEL=<approved model>`
- `OPENAI_API_KEY=<valid key>`
- `OPENAI_VECTOR_STORE_ID` (optional; DB fallback supported)

## Health checks

1. Session bootstrap:
```bash
curl -X POST http://localhost:3000/api/responses/sessions
```

2. Non-stream message:
```bash
curl -X POST http://localhost:3000/api/responses/messages \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"sess_manual","content":"בדיקה","stream":false}'
```

3. Admin runtime validation:
```bash
curl -X POST http://localhost:3000/api/assistants/test \
  -H "Content-Type: application/json" \
  -d '{"testType":"basic"}'
```

## Rollout plan

1. Canary with admin users only.
2. Expand to a small student cohort.
3. Full rollout after 24-48h stable metrics.

Track during rollout:
- HTTP error rate (`/api/responses/messages`)
- p95 latency (`/api/responses/messages`)
- tool-loop success rate (function-call completion)
- stream interruption rate (`response.error`, missing `response.completed`)

## Rollback

Use runtime config rollback endpoint:

```bash
curl -X POST http://localhost:3000/api/assistants/rollback \
  -H "Content-Type: application/json" \
  -d '{"reason":"responses rollout regression"}'
```

If needed, temporarily set:

```bash
OPENAI_API_MODE=assistants
```

Then redeploy and verify admin tests again.

## Post-incident checklist

- Capture failing prompts and tool-call payloads.
- Compare error/latency deltas against baseline in `docs/responses-migration-baseline.md`.
- Document fixes and rerun canary before full re-enable.
