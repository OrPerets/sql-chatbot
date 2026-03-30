# Michael Chat Capability and UX Roadmap

## Goal

Turn Michael from a good SQL tutor chat into a stronger teaching system with:

- deeper multi-turn memory
- safer and more useful tools
- clearer UI output
- richer voice interaction
- better personalization
- stronger observability, evals, and admin controls

This roadmap is grounded in the current codebase and current OpenAI docs.

## Current repo gaps to fix first

- [x] `lib/chat.ts` only stores plain text messages. It should evolve to store structured assistant output, citations, tool usage, latency, and message metadata.
- [x] `lib/openai/responses-client.ts` already uses the Responses API, but it does not yet expose important platform features such as `store`, `conversation` or stronger `previous_response_id` flows, `truncation`, background responses, richer `include` fields, `prompt_cache_key`, or `safety_identifier`.
- [x] `lib/openai/tools.ts` keeps Michael too narrow in main chat. The current catalog is a solid start, but production chat still lacks the tools that make tutoring feel interactive and context-aware.
- [ ] The product has chat, voice, notes, quizzes, student profiles, learning summaries, homework, and analytics, but the assistant does not yet orchestrate them as one coherent tutoring experience.

## Priority 1: Multi-turn chat quality

- [x] Make statefulness explicit in the Responses layer.
  - [x] Choose one canonical approach per surface: `previous_response_id` chaining for lightweight chat, or `conversation` objects for long-lived sessions.
  - [x] Persist response IDs per chat turn so Michael can continue exact context instead of reconstructing history manually.
  - [x] Add fallback behavior when a previous response is missing, expired, or invalid.
- [x] Add `store: true` where long-lived tutoring context is beneficial, and document which routes must remain stateless.
- [x] Add `truncation: "auto"` or an intentional truncation policy for long conversations instead of letting sessions fail once they exceed context limits.
- [x] Add `prompt_cache_key` and `safety_identifier` so repeated tutoring flows are cheaper and safer.
- [x] Store structured turn metadata:
  - [x] response ID
  - [x] model
  - [x] tool calls used
  - [x] latency
  - [x] token usage
  - [x] failure reason

## Priority 2: Better tutoring tools

### Production-safe tool expansion

- [x] Promote `execute_sql_query` to main chat only after adding a strict student-safe sandbox.
  - [x] Enforce read-only SQL.
  - [x] Restrict accessible schemas by chat context.
  - [x] Add row and time limits.
  - [x] Return friendly execution errors and learning hints.
- [x] Add a `validate_sql_answer` tool that checks a student query against expected constraints before Michael explains it.
- [x] Add a `compare_sql_queries` tool so Michael can explain why one query is more correct, readable, or efficient than another.
- [x] Add a `get_homework_context` tool for assignment-specific schema, allowed concepts, due dates, and rubric hints.
- [x] Add a `get_student_learning_profile` tool so the tutor can adapt difficulty, explanation style, and follow-up prompts.
- [x] Add a `save_learning_note` or `remember_preference` tool for things like:
  - [x] preferred language
  - [x] preferred explanation depth
  - [x] repeated SQL weaknesses
  - [x] exam-prep goals
- [x] Add a `generate_next_practice_step` tool that turns a question or mistake into the next recommended exercise.

### Retrieval and knowledge tools

- [x] Add `file_search` for course PDFs, notes, homework instructions, and curated examples.
- [x] Define a source-of-truth corpus for retrieval:
  - [x] official course material
  - [x] homework instructions
  - [x] worked examples
  - [x] FAQ and policy notes
- [x] Add source citations in assistant answers whenever retrieval is used.
- [x] Add retrieval quality tests for Hebrew and English questions, week-based queries, and ambiguous schema questions.

### Advanced tool ideas

- [x] Add `code_interpreter` for admin or advanced analysis flows only, not default student chat.
- [x] Explore remote MCP tools for instructor workflows such as Drive, Sheets, or Notion if Michael should access external academic content or admin material.
- [x] Add a `render_sql_visualization` tool contract that returns structured data for tables, joins, result previews, and execution breakdowns.

## Priority 3: Structured assistant output and UI clarity

- [ ] Replace plain text assistant rendering with structured response blocks using `text.format` JSON schema where the UI benefits from predictable sections.
- [ ] Standardize the tutoring response contract around blocks like:
  - [ ] direct answer
  - [ ] runnable SQL
  - [ ] explanation
  - [ ] common mistakes
  - [ ] result preview
  - [ ] next step
  - [ ] source citations
- [ ] Extend the current SQL tutor schema so it can support follow-up suggestions, confidence, citations, and optional result tables.
- [ ] Evolve `ChatMessage` storage so the frontend can render cards, code blocks, preview tables, and expandable reasoning artifacts instead of a single `text` string.
- [ ] Add message-level affordances:
  - [ ] copy SQL
  - [ ] run query
  - [ ] explain simpler
  - [ ] explain deeper
  - [ ] translate
  - [ ] turn into practice question
- [ ] Stream responses into stable UI sections instead of rendering a single long text blob.

### UI architecture pattern

- [ ] Adopt a data-tool vs render-tool split in the UI layer.
  - [ ] Data tools should fetch or compute.
  - [ ] Render logic should decide how to show result previews, schema cards, and practice suggestions.
- [ ] Avoid coupling every tool response directly to a UI rerender. Let Michael gather data, then choose the best presentation.

## Priority 4: Chat interaction and user experience

- [ ] Add suggested follow-up chips after each answer.
- [ ] Add a mode switch for:
  - [ ] Learn
  - [ ] Debug my SQL
  - [ ] Solve homework carefully
  - [ ] Exam prep
- [ ] Add tone and depth controls:
  - [ ] short answer
  - [ ] step-by-step
  - [ ] beginner
  - [ ] advanced
- [ ] Add bilingual tutoring controls with a first-class Hebrew and English explanation toggle.
- [ ] Add lightweight onboarding so Michael asks 2 to 4 questions when a student is new and tailors future help.
- [ ] Improve error states:
  - [ ] tool unavailable
  - [ ] query sandbox refusal
  - [ ] retrieval miss
  - [ ] long-running analysis
  - [ ] model timeout
- [ ] Add optimistic UI for streaming, progress labels for tool use, and a “Michael is checking the schema / running a query / searching notes” status system.
- [ ] Add conversation title generation based on first successful turn, not only a generic session title.
- [ ] Add bookmark or pin support for important tutor messages.
- [ ] Add “resume where I left off” for unfinished homework or study threads.

## Priority 5: Personalization and agent behavior

- [ ] Add an internal router that chooses the right tutoring behavior before the main response:
  - [ ] schema explainer
  - [ ] SQL debugger
  - [ ] homework coach
  - [ ] exam-prep coach
  - [ ] study planner
- [ ] Start with internal prompt-and-tool routing. Only adopt a full multi-agent architecture if the simpler router stops being maintainable.
- [ ] If multi-agent is introduced, keep the split clean:
  - [ ] one agent for tutoring
  - [ ] one for homework policy/rubric
  - [ ] one for analytics or study planning
  - [ ] one for voice-specific turn handling if needed
- [ ] Add guardrails around agent routing so homework or grading-sensitive flows stay within allowed policy.
- [ ] Use tracing for any future handoffs or multi-agent orchestration from day one.

## Priority 6: Voice and realtime experience

- [ ] Keep `chained` voice as the stable default until the realtime path is production-ready.
- [ ] For `realtime_experimental`, add a production checklist:
  - [ ] ephemeral session issuance
  - [ ] server-side tracing
  - [ ] explicit VAD configuration
  - [ ] interruption handling
  - [ ] truncation policy
  - [ ] session timeout and reconnect logic
- [ ] Add UX for barge-in and interruption so students can stop Michael mid-answer without breaking the flow.
- [ ] Add transcript alignment between spoken output and rendered text.
- [ ] Add voice-specific tutoring style guidance:
  - [ ] shorter sentences
  - [ ] chunked explanations
  - [ ] verbal signposting
  - [ ] recap after tool use
- [ ] Add voice evals for:
  - [ ] latency
  - [ ] turn detection
  - [ ] interruption quality
  - [ ] noisy environment handling
  - [ ] Hebrew pronunciation and mixed-language turns

## Priority 7: Safety, quality, and policy

- [ ] Add strong tool input validation for every production tool schema.
- [ ] Add refusal rules for unsafe or out-of-scope actions such as:
  - [ ] modifying databases
  - [ ] inventing missing homework context
  - [ ] revealing admin-only information
  - [ ] bypassing assignment constraints
- [ ] Add prompt-injection tests for retrieval and tool-heavy routes.
- [ ] Add a clear policy for when Michael should answer directly vs ask a clarifying question.
- [ ] Add structured “I am unsure” behavior for ambiguous schema or missing homework context.
- [ ] Add admin-visible audit trails for runtime config changes, tool enablement, and model changes.

## Priority 8: Observability and evals

- [ ] Add full tracing for chat routes, tool calls, voice sessions, and future agent handoffs.
- [ ] Capture metrics per route:
  - [ ] first-token latency
  - [ ] total response latency
  - [ ] tool-call count
  - [ ] tool failure rate
  - [ ] retrieval hit rate
  - [ ] query execution success rate
  - [ ] voice interruption failures
- [ ] Build an eval set for real product tasks:
  - [ ] write a correct SQL query
  - [ ] explain an incorrect query
  - [ ] answer using course notes
  - [ ] refuse unsupported homework help
  - [ ] continue a multi-turn tutoring session correctly
  - [ ] switch languages correctly
  - [ ] recover from tool failures
- [ ] Add deterministic evals for tool selection and tool argument validity.
- [ ] Add rubric-based evals for:
  - [ ] teaching clarity
  - [ ] correctness
  - [ ] concision
  - [ ] empathy
  - [ ] no hallucinated schema or policy
- [ ] Add red-team coverage for prompt injection, jailbreaks, PII leakage, and off-topic hijacking.

## Priority 9: Admin and instructor workflows

- [ ] Build an admin page to inspect recent tool traces and failed tutoring runs.
- [ ] Let instructors toggle enabled tools by context without editing code.
- [ ] Add runtime prompt versioning with rollback and change notes.
- [ ] Add a retrieval-content management workflow:
  - [ ] upload course PDFs
  - [ ] tag by week and topic
  - [ ] preview chunk quality
  - [ ] retire stale documents
- [ ] Add dashboard views for the most common student chat intents, confusion hotspots, and tool failures.

## Stretch ideas

- [ ] Background responses for long-running analysis and study-plan generation.
- [ ] Multimodal inputs so students can upload screenshots or assignment PDFs directly into chat.
- [ ] Result-table visualization and join animations inside the chat thread.
- [ ] “Teach back to me” mode where Michael quizzes the student before giving the full answer.
- [ ] Collaborative study mode that turns a chat into a sequenced lesson with notes, quizzes, and recap.

## Recommended implementation order

- [ ] Phase 1: statefulness, richer metadata storage, structured assistant output
- [ ] Phase 2: safe SQL execution in main chat, retrieval, better follow-up UX
- [ ] Phase 3: personalization, routing, evals, tracing dashboards
- [ ] Phase 4: realtime voice hardening and advanced MCP or admin integrations

## OpenAI docs used for this roadmap

- Responses API benefits and stateful/tool-first design:
  - https://developers.openai.com/api/docs/guides/migrate-to-responses/#responses-benefits
- Responses create API reference for `store`, `previous_response_id`, `conversation`, built-in tools, background mode, and truncation:
  - https://developers.openai.com/api/reference/resources/responses/methods/create/
- Structured outputs guidance for `text.format` vs function calling:
  - https://developers.openai.com/api/docs/guides/structured-outputs/#function-calling-vs-response-format
- Realtime sessions reference for VAD, tracing, truncation, and tool choice:
  - https://developers.openai.com/api/reference/resources/realtime/subresources/sessions/methods/create/
- Realtime eval guidance for interruption handling, turn detection, and realistic voice QA:
  - https://developers.openai.com/cookbook/examples/realtime_eval_guide/
- Apps SDK UI decoupling pattern that maps well to chat data-vs-render architecture:
  - https://developers.openai.com/apps-sdk/build/chatgpt-ui/#decoupled-pattern
- Agents SDK notes on handoffs, tools, tracing, and guardrails:
  - https://developers.openai.com/cookbook/examples/agents_sdk/multi-agent-portfolio-collaboration/multi_agent_portfolio_collaboration/#best-practices-when-building-agents
