# SQL Chatbot OpenAI Enhancement Roadmap

The SQL Chatbot combines a Next.js front-end with the provided Express + Assistants API backend to help students master SQL. This document captures the forward-looking plan for integrating advanced OpenAI capabilities that deliver richer tutoring, safer SQL experimentation, and better personalization for every learner.

## Guiding Principles
- **Pedagogy first**: Each feature must increase clarity, feedback quality, or motivation for SQL learners.
- **Transparent AI**: Students and instructors should understand when and how AI suggestions are produced.
- **Secure data handling**: Database credentials, student submissions, and analytics stay protected across every API call.
- **Incremental rollout**: Ship improvements behind feature flags with measurable success metrics before broad release.

## Top 5 OpenAI-powered Improvements
Each initiative below highlights the relevant OpenAI features and lists the core tasks required to deliver the enhancement.

### 1. Multi-model Tutor Profiles & Smart Fallbacks
**OpenAI capabilities**: Responses API with model selection (e.g., `gpt-4.1`, `gpt-4o-mini`, `o4-mini`), per-request `reasoning` toggles, and cost telemetry.

**Learner benefit**: Students can pick between fast/explanatory/advanced tutors, while admins maintain guardrails on latency and token spend.

**TODO**
- [ ] Extend user settings UI and `/chat-sessions` payloads to store preferred model + reasoning level.
- [ ] Update backend request builder to map selections to OpenAI Responses API parameters with safe defaults.
- [ ] Implement automatic fallback ladder (e.g., 4o ➝ 4o-mini ➝ 4-mini) when rate limits or outages occur; persist fallback events for monitoring.
- [ ] Surface model + reasoning metadata in the chat transcript so learners understand which tutor responded.

### 2. Schema-aware Function Calling for SQL Guidance
**OpenAI capabilities**: Responses API `tool_choice='auto'`, JSON function calling, function result streaming.

**Learner benefit**: The assistant can inspect live schema snapshots, validate learner SQL, and produce tailored hints before executing anything on the database.

**TODO**
- [ ] Design server-side tool schema (e.g., `describe_tables`, `explain_query`, `run_safe_example`) that expose read-only metadata via the Express server.
- [ ] Register tool definitions with the assistant and implement execution handlers that call existing `DB` utilities.
- [ ] Add guardrails to block destructive statements and sanitize parameters before any DB call.
- [ ] Cache recent schema/function outputs per thread to reduce redundant DB hits and improve response times.

### 3. Retrieval-Augmented Explanations & Course Handouts
**OpenAI capabilities**: Assistants API vector stores, file search, and re-ranking; `response_format` for structured citations.

**Learner benefit**: Answers reference official course materials, homework rubrics, and instructor notes, giving students trustworthy, citation-backed explanations.

**TODO**
- [ ] Ingest syllabi, lecture decks, and graded exemplar answers into an OpenAI vector store via the server’s admin tools.
- [ ] Link chat threads to the appropriate retrieval index (per course, semester, or instructor) during assistant creation.
- [ ] Update UI to display cited snippets with source metadata (lecture title, slide number, etc.) in the message bubble.
- [ ] Build an indexing maintenance job that refreshes embeddings when instructors upload new content.

### 4. Structured SQL Critique & Auto-Scoring Pipeline
**OpenAI capabilities**: Responses API with JSON mode, parallel tool calls, and function calling for rubric checks.

**Learner benefit**: Students receive actionable, rubric-aligned feedback and automated scoring on practice and exam questions while instructors can audit AI rationale.

**TODO**
- [ ] Define a JSON critique schema (score, error categories, fix-it steps) and enforce it via `response_format`.
- [ ] Combine OpenAI analysis with existing `/submitExerciseAnswer` logic to cross-validate keyword checks against AI rubric findings.
- [ ] Persist critiques and scores alongside `DB.saveExamAnswer` results for instructor review dashboards.
- [ ] Add an instructor moderation queue that highlights low-confidence critiques or model disagreements for manual override.

### 5. Real-time Voice & Streaming SQL Walkthroughs
**OpenAI capabilities**: Responses API streaming, Realtime API for audio input/output, `audio.speech` TTS + `audio.transcriptions` STT.

**Learner benefit**: A hands-free tutoring mode where the assistant narrates step-by-step reasoning, listens to follow-up questions, and keeps the 3D Michael avatar in sync.

**TODO**
- [ ] Upgrade the chat front-end to use server-sent events or websockets that relay streaming deltas from the Responses API.
- [ ] Integrate the Realtime API to capture microphone input, transcribe via Whisper, and feed transcripts into the conversation thread.
- [ ] Synchronize avatar state changes (thinking/speaking/listening) with streaming lifecycle events for natural interactions.
- [ ] Provide a downloadable session recap (audio + transcript + SQL snippets) generated from streamed content once a conversation ends.

## Milestones & Measurement
1. **Foundation (Weeks 1–2)**: Ship model switcher + telemetry dashboard. KPI: ≥80% of beta users customize tutor profile without support tickets.
2. **Guided SQL (Weeks 3–5)**: Release function calling + critique pipeline to a pilot class. KPI: 25% reduction in manual grading time; <5% incorrect AI critiques.
3. **Knowledge Depth (Weeks 6–7)**: Turn on retrieval with instructor content. KPI: ≥60% of explanations cite at least one course artifact.
4. **Immersive Mode (Weeks 8–10)**: Deploy streaming voice experience. KPI: 30% of active users complete at least one voice-guided session; CSAT ≥ 4.2/5.

## Risk Mitigation
- Maintain feature flags for every new capability and provide instant rollback paths.
- Log OpenAI request metadata (model, latency, token usage) to monitor cost and reliability.
- Establish human-in-the-loop review for auto-scoring before releasing grades to students.
- Document privacy impact assessments whenever new student data flows through OpenAI endpoints.

## Getting Involved
- **Developers**: Track feature branches and tasks in the project board; pair on tool schema design and UI experiments.
- **Instructors**: Curate the canonical course materials and provide feedback on AI-generated critiques.
- **Students**: Opt into beta tests, report confusing explanations, and help evaluate new tutoring modes.

Together, these enhancements leverage OpenAI’s latest APIs to deliver a safer, smarter, and more personalized SQL learning companion.
