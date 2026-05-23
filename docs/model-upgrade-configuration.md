# Responses Runtime Configuration Guide

This guide describes how to manage model/runtime configuration after the Responses API migration.

## Environment Variables

Add/update these values in `.env.local`:

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_API_MODE=responses
OPENAI_MODEL=gpt-5.4-mini
OPENAI_VECTOR_STORE_ID=
OPENAI_VOICE_MODE=chained
OPENAI_VOICE_RESPONSE_MODEL=gpt-5.4-mini
OPENAI_VOICE_TRANSCRIPTION_MODEL=gpt-4o-transcribe
OPENAI_VOICE_TTS_MODEL=gpt-4o-mini-tts

# Optional compatibility/testing flags
OPENAI_ASSISTANT_ID_GPT5=
USE_GPT5_ASSISTANT=false
```

Deprecated variables: `ASSISTANT_ID`, `OPENAI_ASSISTANT_ID`.

## Runtime Management Endpoints

- Canonical:
  - `GET|POST /api/responses/runtime` - read/update active model, instructions, and tool config
  - `GET|POST /api/responses/runtime/validate` - run live Responses validation tests
  - `GET|POST|PATCH /api/responses/runtime/rollback` - inspect rollback options, rollback config, or run runtime health checks
- Compatibility aliases:
  - `/api/assistants/update`
  - `/api/assistants/test`
  - `/api/assistants/rollback`

## Recommended Upgrade Flow

1. Update config:
```bash
curl -X POST http://localhost:3000/api/responses/runtime \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-5.4-mini"}'
```

2. Run validation tests:
```bash
curl -X POST http://localhost:3000/api/responses/runtime/validate \
  -H "Content-Type: application/json" \
  -d '{"testType":"basic"}'

curl -X POST http://localhost:3000/api/responses/runtime/validate \
  -H "Content-Type: application/json" \
  -d '{"testType":"function_calling"}'
```

3. Monitor in admin UI:
- `/admin/model-management`
- verify error rate, p95 latency, and tool-loop success rate

4. Keep conversation-state expectations explicit:
- Use `previous_response_id` for multi-turn continuity.
- Treat reasoning summaries as optional UI/debug output, not as required application state.
- Stay on the stored Responses path by default. If you move to stateless or zero-data-retention flows later, add explicit handling for encrypted reasoning items before rollout.

## Rollback

Emergency rollback example:

```bash
curl -X POST http://localhost:3000/api/responses/runtime/rollback \
  -H "Content-Type: application/json" \
  -d '{"reason":"increased failure rate"}'
```

## Troubleshooting

1. Check `OPENAI_API_MODE` is `responses`
2. Confirm OpenAI API key and project permissions
3. Verify vector store configuration (`OPENAI_VECTOR_STORE_ID` or DB-backed config)
4. Re-run `/api/responses/runtime/validate` and inspect failed test details
