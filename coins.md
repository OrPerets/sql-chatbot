# Coins & Rewards Infrastructure Plan (MVP First, End-to-End Roadmap)

## Summary
- Build a real (server-enforced) coins feature around the existing coins infrastructure, starting with an MVP where admin can turn coins `ON/OFF`.
- When coins are `OFF`, the system behaves like today (`hide + bypass`): no charging, no rewards, no blocking.
- When coins are `ON`, each Michael message costs `1` coin, enforced server-side.
- Add minimal admin-only protection for coins mutation endpoints (compatible with current localStorage-based admin flow).
- Show balances with polling-based “real time” updates (`5s` admin, `10s` student).
- Use current collections (`Coins`, `CoinsStatus`) for MVP; plan a ledger/rules engine in the next phase.

## Current State (Grounded in Repo)
- There is already coins data and toggle infrastructure in:
  - `/Users/orperetz/Documents/shenkar/sql-chatbot/lib/coins.ts`
  - `/Users/orperetz/Documents/shenkar/sql-chatbot/app/api/users/coins/route.ts`
  - `/Users/orperetz/Documents/shenkar/sql-chatbot/app/components/admin_page.tsx`
- Chat currently updates balance client-side only (not authoritative) in:
  - `/Users/orperetz/Documents/shenkar/sql-chatbot/app/components/chat.tsx`
- The actual AI request goes through:
  - `/Users/orperetz/Documents/shenkar/sql-chatbot/app/api/responses/messages/route.ts`
- There is existing student activity tracking (good base for future rewards) in:
  - `/Users/orperetz/Documents/shenkar/sql-chatbot/lib/data-collection-hooks.ts`
  - `/Users/orperetz/Documents/shenkar/sql-chatbot/lib/activity-tracker.ts`

## MVP Scope (Decision-Complete)
- Include:
  - Admin `ON/OFF` coins toggle that is enforced server-side.
  - Server-side charge of `1 coin` per Michael message.
  - Insufficient balance handling (`block request`).
  - Starter balance seeding of `20 coins` for users with no coins row.
  - Polling-based balance refresh in student and admin UI.
  - Minimal admin auth check for coins mutation endpoints.
- Exclude (future phases):
  - Automated reward rules engine.
  - Ledger/audit UI.
  - True realtime push (SSE/WebSocket).
  - Full authentication/session system.

## Product Behavior Spec (MVP)
- `Coins OFF`:
  - Student coins balance UI is hidden.
  - No server-side charging occurs for Michael usage.
  - No rewards are granted.
  - Michael continues working normally.
  - Existing system behavior remains unchanged.
- `Coins ON`:
  - Student sees current balance.
  - Each user message sent to Michael costs `1 coin`.
  - If balance is insufficient, server rejects request with a structured error.
  - Users without a coins record get auto-seeded to `20 coins` on first coins lookup/charge path.
- Admin control:
  - Admin can toggle feature `ON/OFF`.
  - Admin can add coins to selected user(s) using existing bulk UI (this already satisfies “add to specific user” via single selection).
- Realtime (MVP):
  - Student balance refresh polling every `10s` while coins are `ON`.
  - Admin users/coins list refresh polling every `5s` on admin page.

## Public API / Interface Changes
- Extend request contract for `/Users/orperetz/Documents/shenkar/sql-chatbot/app/api/responses/messages/route.ts`:
  - Add `userEmail?: string` to request body (top-level, not only metadata).
  - Reason: server-side billing needs the acting user.
- Update `/Users/orperetz/Documents/shenkar/sql-chatbot/lib/openai/contracts.ts`:
  - `ChatRequestDto` gains `userEmail?: string`.
- Preserve existing `/api/users/coins` GET behavior for compatibility:
  - `GET ?status=1` remains public (chat/admin UI reads feature status).
  - `GET ?all=1` becomes admin-protected.
- Preserve existing `/api/users/coins` POST route, but secure it:
  - `POST { newStatus }` admin-protected.
  - `POST { users, amount }` admin-protected.
- Preserve existing `/api/users/balance` GET/POST for compatibility, but adjust usage:
  - Chat stops using `POST /api/users/balance` for charging.
  - Server billing becomes authoritative in `/api/responses/messages`.
  - `POST /api/users/balance` becomes admin-protected (used by admin flows only).

## Data Model Changes (MVP)
- Reuse `Coins` collection (`COLLECTIONS.COINS`) for balances.
- Reuse `CoinsStatus` collection (`COLLECTIONS.COINS_STATUS`) but extend the admin config document shape.
- Standardize `CoinsStatus` admin document (`sid: 'admin'`) fields:
  - `sid: 'admin'`
  - `status: 'ON' | 'OFF'`
  - `messageCost: number` (default `1`)
  - `starterBalance: number` (default `20`)
  - `updatedAt: Date`
  - `updatedBy?: string` (best effort, from header)
- Defaults if doc missing:
  - `status = 'OFF'`
  - `messageCost = 1`
  - `starterBalance = 20`

## Service Layer Refactor (MVP Implementation Spec)
- Expand `/Users/orperetz/Documents/shenkar/sql-chatbot/lib/coins.ts` into a single authoritative coins service with methods:
  - `getCoinsConfig()`
  - `setCoinsConfig(partialConfig, updatedBy)`
  - `getOrCreateUserBalance(email)` (seeds starter if missing)
  - `getUserBalance(email)` (normalized object, not raw array internally)
  - `chargeMichaelMessage(email)` (atomic charge or insufficient)
  - `adjustBalanceAdmin(users, delta, adminEmail)` (reuses existing bulk behavior)
- Keep existing exported functions temporarily for compatibility, but route implementations should migrate to the new normalized methods.

## Billing Enforcement Design (Server-Side, MVP)
- Billing hook point:
  - `/Users/orperetz/Documents/shenkar/sql-chatbot/app/api/responses/messages/route.ts`
  - Run billing check before OpenAI request starts.
- Flow:
  - Read coins config.
  - If `OFF`: bypass billing and continue.
  - If `ON`:
    - Validate `userEmail` exists; if missing, return `400`.
    - Ensure user balance row exists (seed to `20` if missing).
    - Atomically decrement by `messageCost` only if balance is sufficient.
    - If insufficient, return `402` with machine-readable error.
- Error contract for insufficient balance:
  - HTTP `402`
  - JSON shape:
    - `error: 'INSUFFICIENT_COINS'`
    - `message: 'Not enough coins'`
    - `balance: number`
    - `required: number`
- Failure/refund policy (MVP):
  - No refund for stream failures after billing succeeds (explicitly accepted MVP simplification).
  - Future phase can add reservation/finalization or ledger-backed compensating transactions.

## Minimal Admin Authorization (MVP)
- Add shared helper (new file):
  - `/Users/orperetz/Documents/shenkar/sql-chatbot/lib/admin-auth.ts`
- Helper behavior:
  - Reads `x-user-email` (or fallback `x-admin-email`) header.
  - Checks against centralized admin allowlist (migrate duplicated arrays to one source).
  - Returns `{ isAdmin, email }` or throws/returns 403 response helper.
- Apply helper to:
  - `POST /api/users/coins`
  - `GET /api/users/coins?all=1`
  - `POST /api/users/balance`
- Keep `GET /api/users/coins?status=1` public.

## Frontend Changes (MVP)
- `/Users/orperetz/Documents/shenkar/sql-chatbot/app/components/chat.tsx`
  - Send `userEmail` in `/api/responses/messages` request body.
  - Stop doing authoritative client-side balance decrement before AI call.
  - On successful response start, refresh balance from server (or poll handles it shortly after).
  - Handle `402 INSUFFICIENT_COINS` with a clear Hebrew message to user.
  - Poll balance every `10s` when coins are `ON`; stop polling when `OFF`.
  - Poll coins status every `10s` (or refresh together with balance endpoint call if unified later).
- `/Users/orperetz/Documents/shenkar/sql-chatbot/app/components/admin_page.tsx`
  - Continue using the existing “מטבעות וירטואליים” toggle, but load/save full config defaults.
  - Send admin email header on coins mutations.
  - Poll users + coins balances every `5s` on admin users view (or refresh coins only to reduce load).
  - Keep admin balance visibility even when coins feature is `OFF` (admin operational visibility).
- Optional cleanup (same MVP if time allows):
  - Remove duplicate `updateCoinsStatus` calls from multiple handlers and centralize in one function.

## Compatibility / Migration
- No destructive migration required.
- Existing rows in `Coins` remain valid.
- Existing `CoinsStatus` doc can be upgraded lazily on first write with added fields.
- Existing client logic that reads array/object from `/api/users/balance` remains supported.
- `OFF` default ensures safe rollout with no surprise billing.

## Testing Plan
- Unit tests (`/Users/orperetz/Documents/shenkar/sql-chatbot/__tests__/api/coins.lib.test.ts` and/or new tests):
  - Returns default config when `CoinsStatus` doc missing.
  - Seeds starter balance (`20`) for missing user.
  - Charges `1` coin successfully when balance >= 1.
  - Rejects charge when balance < 1.
  - Bypass billing when config status `OFF`.
- API route tests:
  - `/api/users/coins?status=1` returns normalized config status.
  - `/api/users/coins?all=1` rejects non-admin, allows admin.
  - `POST /api/users/coins` rejects non-admin, updates status/add-balance for admin.
  - `/api/responses/messages` returns `402` on insufficient coins when ON.
  - `/api/responses/messages` does not require coins when OFF.
- UI/component behavior checks (manual or targeted tests):
  - Student balance hidden when OFF.
  - Student sees balance and periodic refresh when ON.
  - Insufficient balance error is shown clearly.
  - Admin toggle changes behavior without page reload after polling cycle.
  - Admin bulk add updates visible balances after polling.
- Regression checks:
  - Michael still works normally when coins OFF.
  - Existing login flow still populates `currentBalance` without errors.
  - Admin page loads even if no `CoinsStatus` doc exists yet.

## Acceptance Criteria (MVP)
- Admin can toggle coins feature `ON/OFF` from the existing admin settings UI.
- When `OFF`, Michael usage is not charged and balance UI is hidden for students.
- When `ON`, each Michael message charges exactly `1` coin server-side.
- Users without existing coins balance are seeded to `20` coins automatically.
- Insufficient balance blocks Michael request with a user-visible message.
- Admin can add coins to selected user(s) using existing admin UI and see updates via polling.
- Coins mutation/status-all APIs are protected by minimal admin check.

## End-to-End Roadmap (Post-MVP)
- Phase 2: Add `CoinTransactions` ledger (append-only audit trail for all charges/rewards/manual adjustments).
- Phase 2: Add rule engine for automatic rewards based on existing `STUDENT_ACTIVITIES` (questions answered, engagement streaks, homework milestones, special exercises).
- Phase 2: Add idempotency keys for reward grants to avoid duplicate rewards.
- Phase 3: Add admin reward rules UI (thresholds, coin amounts, active/inactive rules).
- Phase 3: Add leaderboard/classroom views and personal history (“למה קיבלתי/ירד לי מטבעות?”).
- Phase 3: Add coin sinks beyond Michael (hint unlocks, retry tokens, premium explanations, exam-prep boosters).
- Phase 4: Replace minimal admin header check with real session/auth and server-side roles.

## Interesting Features to Build on Coins Infrastructure (Future)
- Streak rewards (daily practice/login/chat streak).
- Bonus coins for solving “special challenge” questions.
- Cost discounts for off-hours or teacher-defined campaigns.
- Weekly budget per class (admin-configured).
- Leaderboards by class/week with anti-spam caps.
- Spend coins to unlock “guided hint ladder” instead of full answers.
- Refund/partial refund if AI fails before meaningful response (ledger-backed).
- Achievement badges + coins for milestones (first 10 questions, first full homework completion, improvement streak).

## Explicit Assumptions / Defaults Chosen
- `OFF` means `hide + bypass` (not hidden-only, not block Michael).
- Michael pricing in MVP is fixed `1 coin per user message`.
- Insufficient balance behavior is `block request`.
- Realtime in MVP is polling (`5s` admin, `10s` student), not push.
- Starter balance is auto-seeded to `20` coins.
- Minimal admin auth uses request headers + centralized allowlist (temporary until real auth).
- Ledger/audit trail is intentionally deferred to Phase 2 to keep MVP focused on toggle + enforcement.
