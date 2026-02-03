# Weekly Context Verification (Responses API)

## Status

✅ Verified on Responses API flow.

## End-to-end flow

1. Client sends chat input to `POST /api/responses/messages`.
2. Server appends weekly guardrails/context and starts a Responses tool loop.
3. Tool call `get_course_week_context` is executed server-side (`lib/openai/tools.ts`).
4. Week data is resolved from `lib/content.ts` and SQL restrictions are added.
5. Response is streamed back as NDJSON events:
   - `response.created`
   - `response.output_text.delta`
   - `response.completed`

## Integration points

- Tool schema + execution: `lib/openai/tools.ts`
- Weekly content source: `lib/content.ts`
- Responses route + stream protocol: `app/api/responses/messages/route.ts`
- Chat stream parser: `app/components/chat.tsx`

## Verification checklist

- `get_course_week_context` tool is present in shared tool schemas.
- Returned payload includes `weekNumber`, `content`, `dateRange`, and `sqlRestrictions`.
- SQL examples are constrained by `allowedConcepts` and `forbiddenConcepts`.
- Chat UI receives and renders streamed text via NDJSON events.

## Quick test

```bash
npm run test -- __tests__/lib/responses-client.test.ts
npm run test -- __tests__/mcp-michael.test.ts
```
