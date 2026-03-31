# OpenAI Docs Refinement Plan for Michael

## Goal

Upgrade the current `openai-docs` skill and Michael's related OpenAI-facing runbooks so they are accurate against the current official OpenAI docs, operationally useful inside this repo, and maintainable over time.

## Current Review Summary

### What is good already

- The current skill correctly prioritizes OpenAI official docs over general web search.
- It already points users toward `search_openai_docs`, `fetch_openai_doc`, and `list_openai_docs`.
- It has a reasonable "source of truth" posture and pushes citation-backed answers.

### Main gaps found

1. The skill is **tool-incomplete**.
   - It omits `mcp__openaiDeveloperDocs__list_api_endpoints`.
   - It omits `mcp__openaiDeveloperDocs__get_openapi_spec`.
   - This means endpoint/schema/code-sample questions are not routed to the best tool.

2. The skill is **too generic** for the current OpenAI docs surface.
   - It does not teach the assistant how to choose between Responses API, Chat Completions, Apps SDK, MCP, Realtime, Agents SDK, model docs, or OpenAPI reference.
   - It needs a decision matrix, not only a short workflow.

3. Parts of the content are **terminology-stale**.
   - Official docs now use **apps** rather than **connectors** for ChatGPT integrations.
   - The MCP docs explicitly note the terminology update as of **December 17, 2025**.

4. The Apps SDK summary is **too narrow**.
   - Current docs say an MCP server is required, while UI is optional.
   - The skill currently over-frames Apps SDK as "web component UI + MCP server," which is incomplete.

5. The skill does not distinguish enough between **doc types**.
   - Reference/API schema questions should go to OpenAPI spec and API reference.
   - Conceptual/product guidance should go to guides.
   - Cookbook/examples should be secondary unless the user explicitly wants implementation examples or the guide surface is thin.

6. The skill lacks a strong **latest-model workflow**.
   - Current official docs emphasize GPT-5.4 model guidance, migration guidance, Responses-vs-Chat-Completions comparisons, and new features like `tool_search`.
   - The skill should explicitly force latest-doc verification for model-choice questions.

7. The skill is not yet connected to **Michael's operational docs**.
   - This repo already has OpenAI runtime docs in:
     - `README.md`
     - `docs/responses-api-runbook.md`
     - `docs/model-upgrade-configuration.md`
   - Those docs should be aligned with the same official-docs-backed guidance.

8. There is no **maintenance loop**.
   - No eval checklist.
   - No review cadence.
   - No drift detection process for future doc/API changes.

## Official-Docs Findings That Must Drive the Rewrite

These are the most relevant facts verified from current official OpenAI docs and MCP:

1. OpenAI docs MCP exposes more than search/fetch:
   - `search_openai_docs`
   - `fetch_openai_doc`
   - `list_openai_docs`
   - `list_api_endpoints`
   - `get_openapi_spec`

2. Current official docs position the **Responses API** as the primary advanced API surface.
   - Responses overview explicitly highlights conversation state, built-in tools, function calling, and multimodal inputs.

3. Current docs include explicit migration material for **Responses vs Chat Completions**.
   - The skill should route migration and comparison questions there by default.

4. Current official docs position **GPT-5.4** as the default frontier model for broad general-purpose and coding work.
   - Migration guidance and latest-model guidance are now important first-class sources.

5. Current official docs introduce or highlight newer agentic features that the skill ignores.
   - `tool_search`
   - allowed tools
   - built-in computer use
   - model-specific migration guidance
   - `phase` guidance for long-running/tool-heavy GPT-5.4 flows

6. Apps SDK docs now clearly state:
   - MCP server is required.
   - Web UI is optional.
   - Apps terminology is current.
   - Data-only app flows are valid.

7. MCP docs for ChatGPT apps and API integrations now explicitly document:
   - remote MCP server usage
   - data-only apps
   - `search` / `fetch` compatibility for deep research and company knowledge use cases

8. Voice docs now explicitly recommend architecture selection:
   - chained architecture for predictable/newer voice-agent builders
   - Realtime/Agents SDK for speech-to-speech

## Sprint Plan

## Sprint 1: Fix The `openai-docs` Skill Contract

### Objective

Make the skill text correct, current, and tool-complete.

### Tasks

1. Rewrite the "Quick start" section into a **tool-selection matrix**.
   - `search_openai_docs`: use first for scoped discovery.
   - `fetch_openai_doc`: use for exact guidance and quotations/paraphrases.
   - `list_openai_docs`: use only for browsing when query scope is unclear.
   - `list_api_endpoints`: use when user asks "which endpoint," "what endpoints exist," or "where is X in the API."
   - `get_openapi_spec`: use for endpoint schema, parameters, request/response bodies, and language-specific code examples.

2. Replace "OpenAI product snapshots" with a **current decision tree**.
   - Responses API
   - Chat Completions
   - Apps SDK
   - MCP for ChatGPT apps/API integrations
   - Realtime API
   - Agents SDK
   - Model docs / latest-model guide
   - Codex docs

3. Update stale terminology.
   - Use `apps` as the primary term.
   - Mention that `connectors` is older terminology and should only be mentioned when clarifying older language.

4. Correct the Apps SDK description.
   - MCP server required.
   - UI optional.
   - Web component should not be treated as mandatory.

5. Add a doc-type hierarchy.
   - First choice: guides + API reference + model docs.
   - Second choice: OpenAPI spec tools for schema/code examples.
   - Third choice: cookbook/examples when official guides are thin or user wants implementation examples.

6. Add a "latest verification" rule.
   - If the user asks for latest/current/best/recommended model, capabilities, migrations, limits, deprecations, or architecture guidance, the assistant must verify against official docs before answering.

7. Fix the MCP-install fallback wording.
   - Remove assumptions that escalated permissions are always available.
   - Rewrite into portable behavior: attempt install if allowed; if blocked by environment or approval policy, tell the user what command is needed and why.

### Deliverables

- Updated `/Users/orperetz/.codex/skills/openai-docs/SKILL.md`
- Cleaner structure with explicit sections:
  - Tool routing
  - Product/architecture routing
  - Citation rules
  - Fallback rules

### Acceptance Criteria

- Skill text mentions all 5 OpenAI docs MCP tools.
- Skill text uses `apps` as the canonical term.
- Skill text no longer implies Apps SDK UI is mandatory.
- Skill text clearly tells the assistant when to use OpenAPI spec vs guide docs.

## Sprint 2: Make The Skill Operationally Better, Not Just More Correct

### Objective

Make answers produced via `openai-docs` higher quality and more repeatable.

### Tasks

1. Add a **question-routing cookbook** inside the skill.
   - "How do I use endpoint X?" -> `get_openapi_spec`
   - "Which API should I use?" -> guide docs + comparison docs
   - "What is the latest best model?" -> latest-model guide + relevant model page
   - "How do I build a ChatGPT app?" -> Apps SDK quickstart/build/auth/connect docs
   - "How do I build an MCP server for ChatGPT/API?" -> MCP guide
   - "How do I build voice agents?" -> voice-agents + realtime docs

2. Add answer templates for common task types.
   - Endpoint/schema answer
   - Model recommendation answer
   - Migration answer
   - Apps SDK/MCP answer
   - Voice/Realtime answer

3. Add citation/output rules that are stronger than the current version.
   - Always cite page title + URL in the final answer.
   - State when the answer is derived from API reference vs guide vs cookbook.
   - Call out when guidance is an inference rather than a direct statement.

4. Add explicit comparison guidance for **Responses vs Chat Completions**.
   - Prefer Responses for new advanced agentic/multimodal/tool workflows.
   - Use comparison docs when the user is deciding whether to migrate.

5. Add explicit model-guidance routing.
   - Latest model guide first
   - Specific model page second
   - Prompt guidance third

6. Add a "do not answer from memory" clause for unstable areas.
   - latest models
   - deprecations
   - parameter compatibility
   - pricing/limits
   - Apps/MCP terminology

### Deliverables

- Expanded `openai-docs` skill content with reusable routing patterns
- A compact internal QA section inside the skill:
  - "If asked X, you should search/fetch Y"

### Acceptance Criteria

- A new contributor can read the skill and correctly choose the right doc MCP tool without guessing.
- The skill explicitly covers Responses-vs-Chat-Completions, Apps SDK, MCP, model choice, and voice/realtime.
- The skill makes fewer "generic doc search" calls and more targeted spec/reference calls.

## Sprint 3: Align Michael's Repo Docs And OpenAI Runtime Guidance

### Objective

Bring Michael's local documentation into alignment with the improved `openai-docs` skill and current official OpenAI guidance.

### Tasks

1. Update the repo's OpenAI-facing docs to reflect the current official guidance.
   - `README.md`
   - `docs/responses-api-runbook.md`
   - `docs/model-upgrade-configuration.md`

2. Add a new internal doc:
   - `docs/openai-docs-usage-guide.md`
   - Purpose: when Michael maintainers should use official docs MCP, what to verify, and what must never be answered from memory.

3. Add a Michael-specific model/runtime decision matrix.
   - `gpt-5.4` for complex admin/eval/coding-heavy workflows
   - `gpt-5.4-mini` for high-volume tutor chat if quality/cost balance remains acceptable
   - note migration checkpoints when changing either

4. Add an OpenAI feature adoption backlog for Michael.
   - Evaluate `tool_search` for growing tool surfaces in `lib/openai/tools.ts`
   - Evaluate allowed-tools restrictions per context
   - Review whether GPT-5.4 `phase` support matters for Michael's long-running/admin flows
   - Review whether current reasoning configuration should expose `none/low/medium/high/xhigh` more explicitly in admin tooling

5. Update operational guidance around Responses usage.
   - Keep `previous_response_id` as canonical continuity mechanism
   - note that reasoning summaries are UI/debug artifacts, not application truth
   - explicitly document when to consult official docs before runtime changes

6. Review voice architecture docs in the repo against current official voice guidance.
   - confirm current `chained` production stance remains deliberate
   - document why Michael is not using a speech-to-speech realtime architecture by default

### Deliverables

- Updated repo docs
- New `docs/openai-docs-usage-guide.md`
- Clear Michael-specific adoption notes for newer OpenAI capabilities

### Acceptance Criteria

- A maintainer can safely plan a model/runtime upgrade from local docs without relying on memory.
- Repo docs point maintainers back to official docs for unstable decisions.
- Michael's documented runtime posture matches the actual codebase:
  - `app/agent-config.ts`
  - `lib/openai/model-registry.ts`
  - `lib/openai/responses-client.ts`

## Sprint 4: Add Validation, Drift Detection, And Ownership

### Objective

Prevent the skill and Michael's OpenAI docs from drifting again.

### Tasks

1. Create an eval checklist for the `openai-docs` skill.
   - Example prompts:
     - "Which tool should I use for endpoint schema details?"
     - "What is the current recommended model for general coding work?"
     - "How do I build a ChatGPT app with no UI?"
     - "Should I use Responses or Chat Completions for a multi-turn tool-using app?"
     - "How do I expose an MCP server for deep research/company knowledge?"
     - "What architecture should I use for a new voice agent?"

2. Define pass/fail expectations for each eval prompt.
   - correct tool routing
   - correct official-doc source
   - correct terminology
   - current answer, not stale memory

3. Add a maintenance cadence.
   - Monthly light review of latest-model + apps/mcp docs
   - Quarterly full review of the skill text and Michael docs
   - Immediate review when a major OpenAI model/API/blog/docs release affects Michael

4. Assign explicit ownership.
   - Michael maintainer owns repo-doc alignment
   - skill maintainer owns `openai-docs` prompt/skill text
   - release owner signs off on OpenAI model/runtime changes

5. Add a small changelog section either inside the skill or in repo docs.
   - what changed
   - why it changed
   - docs reviewed
   - review date

### Deliverables

- `docs/openai-docs-evals.md` or equivalent
- Maintenance cadence section in repo docs
- Named owner in the relevant doc

### Acceptance Criteria

- There is a repeatable way to detect skill drift.
- There is a named owner and a review cadence.
- Future model/API upgrades are less ad hoc.

## Recommended File Touch List

### Must update

- `/Users/orperetz/.codex/skills/openai-docs/SKILL.md`
- `/Users/orperetz/Documents/shenkar/sql-chatbot/README.md`
- `/Users/orperetz/Documents/shenkar/sql-chatbot/docs/responses-api-runbook.md`
- `/Users/orperetz/Documents/shenkar/sql-chatbot/docs/model-upgrade-configuration.md`

### Strongly recommended new docs

- `/Users/orperetz/Documents/shenkar/sql-chatbot/docs/openai-docs-usage-guide.md`
- `/Users/orperetz/Documents/shenkar/sql-chatbot/docs/openai-docs-evals.md`

### Relevant code touchpoints to review during doc alignment

- `/Users/orperetz/Documents/shenkar/sql-chatbot/app/agent-config.ts`
- `/Users/orperetz/Documents/shenkar/sql-chatbot/lib/openai/model-registry.ts`
- `/Users/orperetz/Documents/shenkar/sql-chatbot/lib/openai/tools.ts`
- `/Users/orperetz/Documents/shenkar/sql-chatbot/lib/openai/responses-client.ts`
- `/Users/orperetz/Documents/shenkar/sql-chatbot/app/api/responses/messages/route.ts`
- `/Users/orperetz/Documents/shenkar/sql-chatbot/app/api/admin/test-gpt/route.ts`

## Priority Order

### P0

- Sprint 1 complete
- Sprint 2 complete

### P1

- Sprint 3 repo doc alignment

### P2

- Sprint 4 eval/maintenance loop

## Notes For Michael

1. Do not treat `openai-docs` as only a "search the docs" helper.
   - It should become a routing and verification skill for all OpenAI product questions.

2. Do not let Michael runtime docs drift from the skill.
   - The skill and repo runbooks should reinforce the same operating model.

3. Keep the skill optimized for **current OpenAI docs**, not historical product memory.
   - This matters most for models, Apps/MCP terminology, migration guidance, and parameter compatibility.

## Sources Reviewed

- OpenAI docs MCP: `list_api_endpoints`
- OpenAI docs MCP: `get_openapi_spec` for `/responses`
- OpenAI docs: Responses Overview
- OpenAI docs: Apps SDK Quickstart
- OpenAI docs: Building MCP servers for ChatGPT Apps and API integrations
- OpenAI docs: Using GPT-5.4
- OpenAI docs: Voice agents
- OpenAI docs search results covering:
  - Responses vs Chat Completions
  - Realtime guidance
  - Agents SDK references surfaced through current official docs/cookbook pages
