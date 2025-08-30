# Michael SQL Chatbot Overview

## Introduction
Michael is an interactive SQL tutoring application that combines a conversational
interface with a lifelike 3D avatar. Designed for undergraduate students and
their instructors, the project leverages Next.js for web delivery, the OpenAI API
for natural language understanding, and a custom avatar system to deliver
explanations, examples, and feedback.

The application is also a research platform to explore multimodal teaching
experiences. The avatar, nicknamed **Michael**, guides learners through SQL
concepts, demonstrates queries, and responds to natural language questions.

## Functionality
- **Conversational SQL Tutor** – Users type questions in natural language or SQL. Michael parses requests, executes queries on embedded databases, and explains results step by step.
- **3D Avatar Guidance** – A TalkingHead-based 3D model provides expressive visual feedback, lip-sync, and gestures while delivering explanations.
- **Smart Fallbacks** – When WebGL or 3D assets fail to load, the system automatically uses 2D Lottie animations to ensure continuous interaction.
- **Voice Integration** – Optional text-to-speech (TTS) and speech-to-text (STT) pipelines allow hands‑free interactions.
- **Environment Flags** – Feature gates in `.env` allow precise control of avatar and voice functionality during experiments.

## Abilities and Features
1. **SQL Execution Engine**
   - Utilizes `sql.js` or `alasql` to run queries in the browser.
   - Displays schema diagrams with Cytoscape to visualize table relationships.
   - Provides step-by-step explanations of query logic.
2. **Dynamic Avatar Modes**
   - Primary 3D mode with lip-sync, gestures, and multilingual voice (Hebrew & English).
   - Secondary 2D mode with smooth Lottie animations for older browsers or slower devices.
   - State machine supports `idle`, `speaking`, `listening`, `thinking`, and `celebrating` states.
3. **Progressive Enhancement Architecture**
   - Loads 3D assets lazily and falls back gracefully without breaking the chat flow.
   - Timeouts and retry logic prevent hanging screens or failed loads.
4. **Customization Hooks**
   - Developers can swap avatar models or tweak behaviors via `SmartMichaelAvatar` component props (`preferMichael`, `fallbackToLottie`, `loadTimeout`).
   - Asset compression scripts (`npm run compress:glb`) ensure efficient 3D delivery.
5. **Testing Interface**
   - A dedicated page `/test-michael-integration` exposes toggles for avatar modes, timeout thresholds, and error simulation.

## Chat Interface and History
The primary experience lives on the chat page. Each session preserves a scrolling
history of prompts, SQL attempts, and Michael's responses so that students and
instructors can review prior steps. Messages are timestamped and tagged with the
current mode (learning or exam) to support analytics and replay during studies.

## Exam and Admin Modes
- **Exam Mode** – Timed, adaptive assessments escalate from easy to hard and
  record attempt metadata. Michael provides only rubric‑aligned feedback and
  respects extra‑time accommodations when configured.
- **Admin Panel** – Instructors can seed question banks, review logs, toggle
  feature flags, and inspect student progress through lightweight utilities.

## Instructional Design
Michael follows a pedagogical contract to keep answers concise and actionable.
Core behaviors include:
1. Short staged explanations followed by examples and mini exercises.
2. Explicit reasoning that states assumptions and compares alternatives when helpful.
3. SQL help flow that asks for schema once, then labels assumptions clearly.
4. Encouraging tone with targeted hints before full solutions.
5. Safety rules that avoid leaking exam answers or sensitive data.

Response patterns:
- **Concept → Example → Mini‑Exercise** for guided learning.
- **Error/Debug Review** to pinpoint bugs and suggest fixes.
- **Exam Step** with timer reminders and minimal feedback.

SQL conventions:
- Prefer CTEs, explicit `JOIN ... ON` clauses, and window functions where appropriate.
- Label assumptions clearly and guard against NULL or duplicate pitfalls.

## Analytics and Motivation
Every interaction emits telemetry (`event_type`, `mode`, `topic`, `latency_ms`,
`quality_signal`, etc.) for research while respecting privacy flags. A coin
system rewards milestones like correct queries or thoughtful revisions. Michael
never self‑mints coins and surfaces balances only when relevant.

## Use Cases
- **Self‑Paced Learning** – Students query sample databases, receive guided explanations, and visualize schema structures.
- **Classroom Demonstrations** – Instructors project Michael onto screens to demonstrate SQL syntax and best practices.
- **Accessibility Experiments** – Researchers evaluate the impact of visual and verbal cues on knowledge retention.
- **Voice‑Driven Tutoring** – Learners with limited keyboard access engage through speech recognition and TTS feedback.

## User Stories
- *As a beginner*, I want to ask “What is a JOIN?” and receive a visual explanation and sample queries.
- *As an intermediate learner*, I want to experiment with complex queries and have Michael validate and optimize my SQL.
- *As an instructor*, I want a demonstration tool that shows how to query databases while Michael narrates.
- *As a researcher*, I want to enable or disable avatar and voice modules independently to measure their learning impact.

## Technical Stack
- **Framework:** Next.js with TypeScript
- **Avatar:** Three.js + TalkingHead for 3D, Lottie for 2D fallback
- **AI:** OpenAI’s GPT models for language understanding and TTS/STT endpoints for voice
- **Database:** `sql.js`/`alasql` for in-browser execution
- **Visualization:** Cytoscape for schema graphs, React components for UI
- **Asset Management:** Draco mesh compression and optional KTX2 texture compression

## Research Considerations
This project supports experimental configurations through feature flags, making it suitable for controlled studies. Researchers can vary avatar presence, voice feedback, or query complexity to evaluate learning outcomes.

## Future Directions
- Expanded avatar library with diverse personas
- Deeper curriculum integration with interactive lessons
- Collaborative modes where multiple learners interact with a shared avatar
- Advanced analytics to track learning progress and query history

---
Michael combines conversational AI with an expressive avatar to create an engaging environment for learning SQL. This document summarizes the system for research and documentation purposes.
