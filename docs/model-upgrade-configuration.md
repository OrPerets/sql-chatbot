# Responses Runtime Configuration Guide

This guide describes how to manage model/runtime configuration after the Responses API migration.

## Environment Variables

Add/update these values in `.env.local`:

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_API_MODE=responses
OPENAI_MODEL=gpt-4.1-mini
OPENAI_VECTOR_STORE_ID=

# Optional compatibility/testing flags
OPENAI_ASSISTANT_ID_GPT5=
USE_GPT5_ASSISTANT=false
```

Deprecated variables: `ASSISTANT_ID`, `OPENAI_ASSISTANT_ID`.

## Runtime Management Endpoints

- `POST /api/assistants/update` - update active model/instructions/tools runtime config
- `POST /api/assistants/test` - run live Responses validation tests
- `POST /api/assistants/rollback` - rollback runtime config to a prior snapshot

## Recommended Upgrade Flow

1. Update config:
```bash
curl -X POST http://localhost:3000/api/assistants/update \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4.1-mini"}'
```

2. Run validation tests:
```bash
curl -X POST http://localhost:3000/api/assistants/test \
  -H "Content-Type: application/json" \
  -d '{"testType":"basic"}'

curl -X POST http://localhost:3000/api/assistants/test \
  -H "Content-Type: application/json" \
  -d '{"testType":"function-calls"}'
```

3. Monitor in admin UI:
- `/admin/model-management`
- verify error rate, p95 latency, and tool-loop success rate

## Rollback

Emergency rollback example:

```bash
curl -X POST http://localhost:3000/api/assistants/rollback \
  -H "Content-Type: application/json" \
  -d '{"reason":"increased failure rate"}'
```

## Troubleshooting

1. Check `OPENAI_API_MODE` is `responses`
2. Confirm OpenAI API key and project permissions
3. Verify vector store configuration (`OPENAI_VECTOR_STORE_ID` or DB-backed config)
4. Re-run `/api/assistants/test` and inspect failed test details
