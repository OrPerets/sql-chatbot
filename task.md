# Repo Cleanup, Optimization, and Refactor Plan

This plan keeps all existing functionality intact (chatbot, admin, and all routes) while removing dead code, optimizing performance, and improving maintainability. Work is divided into sprints with clear TODOs and deliverables. Execute sprints in order and keep the application runnable at the end of each sprint.

---

## Sprint 0 — Baseline, Inventory, and Safety Nets

**Goal:** Establish a reliable baseline, inventory usage, and protect critical behavior before refactors.

**TODO**
- Run existing tests and document the baseline status (what passes/fails and why).
- Inventory routes, API endpoints, and key user flows (chatbot, admin, auth, and any integrations).
- Document runtime entrypoints (Next.js pages/app routes, API routes, middleware, scripts).
- Identify environment variables and config dependencies (e.g., `.env` and deployment configs).
- Add/confirm linting and formatting scripts; ensure they run without changing behavior.
- Create a “do not break” list of features with acceptance criteria.

**Deliverables**
- Baseline test report.
- Route/endpoint inventory map.
- “Do not break” acceptance checklist.

### Sprint 0 — Implementation Notes (Done)

**Baseline test report**
- `npm test` ✅ (23/23 suites passed; 218/220 tests passed; 2 skipped). Console warnings/errors are expected from test fixtures (mocked API errors, React `act(...)` warnings) and do not fail the suite.

**Route/endpoint inventory map**
- **Public app routes**
  - `/` (main chatbot UI).
  - `/english-demo`.
  - `/403`.
  - `/auth/reset-password`.
- **Entities demos**
  - `/entities/all`, `/entities/basic-chat`, `/entities/file-search`, `/entities/function-calling`, `/entities/questionnaire`, `/entities/enhanced-avatar-demo`.
- **Homework flows**
  - `/homework` + `/homework/start`, `/homework/questions`, `/homework/runner/[setId]`.
  - Builder/admin flows: `/homework/builder`, `/homework/builder/create`, `/homework/builder/[setId]/{edit,preview,publish,grade,solution}`.
- **Admin UI**
  - `/admin` + `/admin/{datasets,databases,templates,templates/new,homework,chat-report,model-management,mcp-michael}`.
- **API routes (selected groupings)**
  - Auth/users: `/api/auth/*`, `/api/users/*`.
  - Chat + assistants: `/api/chat/*`, `/api/assistants/*`, `/api/conversation-summary/*`.
  - Homework + submissions: `/api/homework/*`, `/api/submissions/*`.
  - Admin + analytics: `/api/admin/*`, `/api/analysis/*`, `/api/analytics/*`, `/api/students/*`.
  - Content + datasets + templates: `/api/datasets/*`, `/api/templates/*`, `/api/content/*`.
  - SQL + practice + grading: `/api/sql/execute`, `/api/practice/*`, `/api/grading/*`.
  - Voice + audio: `/api/voice/*`, `/api/audio/*`, `/api/tts`.

**Runtime entrypoints**
- Next.js app router: `app/layout.tsx`, `app/page.tsx`, and all `app/**/page.tsx` routes.
- API handlers: `app/api/**/route.ts` (see inventory above).
- Middleware: `middleware.ts`.
- CLI/scripts: `npm run <script>` in `package.json` (maintenance, database setup, deployment verify, etc.).

**Environment variables & config dependencies**
- App/runtime: `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_ASSISTANT_ID`, `OPENAI_ASSISTANT_ID_GPT5`, `USE_LATEST_MODEL`, `USE_GPT5_ASSISTANT`.
- Voice/feature flags: `FEATURE_VOICE`, `NEXT_PUBLIC_VOICE_ENABLED`, `NEXT_PUBLIC_AVATAR_ENABLED`, `NEXT_PUBLIC_ANALYTICS_ENABLED`, `NEXT_PUBLIC_CONTEXT_AWARE`, `NEXT_PUBLIC_VISUALIZATION_ENABLED`, `NEXT_PUBLIC_ACCESSIBILITY_ENABLED`, `NEXT_PUBLIC_REALTIME_ENABLED`, `NEXT_PUBLIC_AUDIO_PROCESSING`, `NEXT_PUBLIC_DEBUG_VOICE`, `NEXT_PUBLIC_SERVER_BASE`.
- Database: `MONGODB_URI`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `DB_MIN_POOL_SIZE`, `DB_MAX_POOL_SIZE`.
- Email/SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`.
- Deployment: `NEXT_PUBLIC_BASE_URL`, `INTERNAL_API_BASE_URL`, `NEXT_PUBLIC_API_BASE_URL`, `VERCEL`, `AWS_LAMBDA_FUNCTION_NAME`.

**Lint/format scripts (confirmed in package.json)**
- `npm run lint` (Next.js lint).
- No formatter script present; Prettier config exists in `package.json`.

**Do not break — acceptance checklist**
- Chatbot core flow: load `/`, send message, receive assistant response (OpenAI or fallback stubs).
- Auth flow: reset password request and token validation (`/auth/reset-password`, `/api/auth/forgot-password`, `/api/auth/reset-password`).
- Admin access: `/admin` and primary admin tools (datasets, templates, homework, chat report, model management).
- Homework delivery: student can start homework, answer questions, submit, and see status.
- Grading/analysis: `/api/grading/*`, `/api/submissions/*`, `/api/analysis/*` continue to work.
- Voice features (when enabled): audio/voice endpoints respond with feature-flag gating.

---

## Sprint 1 — Dead Code & Asset Removal (Low Risk)

**Goal:** Remove unused files, scripts, and assets with zero functional changes.

**TODO**
- Identify unused dependencies (production and dev) and remove them.
- Find and remove unused scripts, test-only artifacts, and obsolete config entries.
- Delete unused assets (images, fonts, fixtures, mock data) confirmed by usage scan.
- Remove stale experimental code paths and feature flags not used in production.
- Update documentation and references after removals.

**Deliverables**
- Cleaned dependency list with justification notes.
- Removed unused assets and scripts.
- Updated docs reflecting new structure.

---

## Sprint 2 — Performance & Bundle Optimization

**Goal:** Reduce bundle size, improve runtime performance, and ensure fast page loads.

**TODO**
- Analyze bundle size; identify large modules and optimize imports.
- Implement code-splitting where appropriate (dynamic imports for non-critical UI).
- Remove redundant polyfills and duplicated utilities.
- Audit data fetching and caching patterns; reduce redundant requests.
- Optimize images and static assets (Next.js Image where applicable).
- Ensure middleware does not block critical paths unnecessarily.

**Deliverables**
- Bundle analysis report with size deltas.
- Measurable improvements to key metrics (TTFB/CLS/LCP as applicable).
- Documented performance changes.

---

## Sprint 3 — Refactor for Maintainability (Medium Risk)

**Goal:** Simplify architecture and improve readability without changing behavior.

**TODO**
- Consolidate duplicate utilities and shared logic into single modules.
- Normalize folder structure and naming conventions.
- Split overly large components/services into smaller units.
- Improve typing (TypeScript) and remove `any` where possible.
- Add clear boundaries between UI, data access, and domain logic.
- Improve error handling and logging consistency.

**Deliverables**
- Refactored module layout.
- Improved type coverage and lint results.
- Updated architecture notes.

---

## Sprint 4 — Reliability & Test Coverage

**Goal:** Increase confidence with tests and validate behavior across key features.

**TODO**
- Add/expand tests for chatbot, admin, and critical routes.
- Add integration tests for major workflows.
- Ensure regression coverage for previously fixed bugs.
- Verify auth and permissions boundaries.
- Establish test data fixtures that mirror production expectations.

**Deliverables**
- Expanded test suite and updated coverage summary.
- Regression tests for critical flows.

---

## Sprint 5 — Production Hardening & Observability

**Goal:** Ensure production readiness and operational clarity.

**TODO**
- Validate environment configuration across dev/staging/prod.
- Improve runtime logging; add structured logs for key actions.
- Validate error reporting and alerting integrations.
- Review security: input validation, auth, rate limiting, and secrets handling.
- Document operational runbooks (deploy, rollback, incident response).

**Deliverables**
- Production readiness checklist.
- Observability/logging updates.
- Operational runbook.

---

## Sprint 6 — Final Verification & Cleanup

**Goal:** Confirm stability, remove any remaining unused items, and finalize docs.

**TODO**
- Re-run all tests and performance checks.
- Validate all acceptance criteria from Sprint 0.
- Final sweep for unused files, dead code, and stale docs.
- Update README/architecture docs with final state.

**Deliverables**
- Final test and performance report.
- Updated documentation set.
- Clean repo status with no unused artifacts.
