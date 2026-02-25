# Coins & Rewards MVP – Implementation Tasks

Step-by-step implementation plan derived from `coins.md`. Each sprint has a goal, deliverables, and a detailed todo list. Complete sprints in order; dependencies are explicit.

---

## Sprint 1: Coins Service, Data Model & Admin Auth

**Goal:** Single authoritative coins service in `lib/coins.ts`, standardized `CoinsStatus` shape, and a shared admin-auth helper. No API or UI behavior changes yet.

**Deliverables:**
- Extended `CoinsService` with new methods; existing exports kept for compatibility.
- `CoinsStatus` admin document shape standardized with defaults.
- New `lib/admin-auth.ts` with centralized admin allowlist and request check.

---

### 1.1 Standardize CoinsStatus type and defaults

- [x] **1.1.1** In `lib/coins.ts`, add a TypeScript interface for the admin config document:
  - `CoinsConfigDoc`: `{ sid: 'admin'; status: 'ON' | 'OFF'; messageCost: number; starterBalance: number; updatedAt: Date; updatedBy?: string }`
- [x] **1.1.2** Define constants in `lib/coins.ts`: `DEFAULT_MESSAGE_COST = 1`, `DEFAULT_STARTER_BALANCE = 20`, `DEFAULT_STATUS: 'ON' | 'OFF' = 'OFF'`.
- [x] **1.1.3** Document in code (or a short comment): when the `CoinsStatus` doc is missing, treat as `status = DEFAULT_STATUS`, `messageCost = DEFAULT_MESSAGE_COST`, `starterBalance = DEFAULT_STARTER_BALANCE`.

---

### 1.2 Implement getCoinsConfig() and setCoinsConfig()

- [x] **1.2.1** In `CoinsService`, add `getCoinsConfig(): Promise<CoinsConfigDoc>`:
  - Query `COLLECTIONS.COINS_STATUS` for `{ sid: 'admin' }`.
  - If no document: return a normalized object with defaults (`status`, `messageCost`, `starterBalance`, `updatedAt`, optional `updatedBy`).
  - If document exists: map to `CoinsConfigDoc`, filling missing fields with defaults.
- [x] **1.2.2** In `CoinsService`, add `setCoinsConfig(partial: Partial<Pick<CoinsConfigDoc, 'status' | 'messageCost' | 'starterBalance'>>, updatedBy?: string)`:
  - Set `updatedAt: new Date()`, `updatedBy` from argument.
  - Use `updateOne({ sid: 'admin' }, { $set: { ...partial, updatedAt, updatedBy } }, { upsert: true })`.
  - Ensure only allowed fields are written (no arbitrary fields).

---

### 1.3 Implement getOrCreateUserBalance(email) and getUserBalance(email)

- [x] **1.3.1** Add `getOrCreateUserBalance(email: string)`:
  - Get config via `getCoinsConfig()`.
  - Find `Coins` doc by `user: email`. If found, return normalized balance object `{ user, coins }` (or same shape you use elsewhere).
  - If not found: insert one document `{ user: email, coins: config.starterBalance }`, then return that normalized object.
  - Use `executeWithRetry` / existing DB pattern; keep insert idempotent (e.g. use upsert or check-then-insert in a safe way to avoid races).
- [x] **1.3.2** Add `getUserBalance(email: string)` (no creation):
  - Find `Coins` doc by `user: email`; return normalized `{ user, coins }` or a canonical “no row” representation (e.g. `{ user: email, coins: 0 }` or null—document which you use).
  - Do not insert; used when you only need to read.

---

### 1.4 Implement chargeMichaelMessage(email)

- [x] **1.4.1** Add `chargeMichaelMessage(email: string): Promise<{ ok: true } | { ok: false; balance: number; required: number }>`:
  - Call `getCoinsConfig()`. If `status !== 'ON'`, return `{ ok: true }` (no charge).
  - Call `getOrCreateUserBalance(email)` so user has a row.
  - Get `messageCost` from config.
  - In a single atomic operation: `findOneAndUpdate({ user: email, coins: { $gte: messageCost } }, { $inc: { coins: -messageCost } }, { returnDocument: 'after' })`.
  - If no document matched (insufficient balance): get current balance (e.g. via `getUserBalance`), return `{ ok: false, balance, required: messageCost }`.
  - If matched: return `{ ok: true }`.

---

### 1.5 Implement adjustBalanceAdmin(users, delta, adminEmail)

- [x] **1.5.1** Add `adjustBalanceAdmin(users: string[], delta: number, adminEmail?: string)`:
  - Reuse existing `updateCoinsBalance(users, amount)` logic (e.g. call it or inline the same `updateMany` / `$inc`).
  - Signature and behavior compatible with current admin “add coins” flow (delta can be positive or negative).
  - Log or store `adminEmail` only if you add an audit field later; for MVP, parameter is for future use.

---

### 1.6 Export new methods and keep backward compatibility

- [x] **1.6.1** Keep existing exported functions: `updateCoinsBalance`, `getAllCoins`, `getCoinsStatus`, `setCoinsStatus` (they can delegate to the new methods or stay as-is temporarily).
- [x] **1.6.2** Export new API: e.g. `getCoinsConfig`, `setCoinsConfig`, `getOrCreateUserBalance`, `getUserBalance`, `chargeMichaelMessage`, `adjustBalanceAdmin` (either from class or as thin wrappers that get service and call the method).

---

### 1.7 Create lib/admin-auth.ts

- [x] **1.7.1** Create file `lib/admin-auth.ts`.
- [x] **1.7.2** Define a single source of truth for admin emails: e.g. `ADMIN_EMAILS: string[]` (migrate from `app/landing/page.tsx` and `app/components/admin_page.tsx`: `["liorbs89@gmail.com", "eyalh747@gmail.com", "orperets11@gmail.com", "roeizer@shenkar.ac.il", "r_admin@gmail.com"]`). Prefer env var override if you want (e.g. `process.env.ADMIN_EMAILS?.split(',') || DEFAULT_ADMIN_EMAILS`).
- [x] **1.7.3** Implement `getAdminFromRequest(request: Request): { isAdmin: boolean; email: string | null }`:
  - Read header `x-user-email` or fallback `x-admin-email` (lowercase header names).
  - If no email: return `{ isAdmin: false, email: null }`.
  - If email in allowlist: return `{ isAdmin: true, email }`.
  - Else: return `{ isAdmin: false, email }`.
- [x] **1.7.4** Implement `requireAdmin(request: Request): Promise<{ email: string }>`:
  - Call `getAdminFromRequest(request)`.
  - If `!isAdmin`: throw or return a `NextResponse.json({ error: 'Forbidden' }, { status: 403 })` (document which). If you return a response, the route handler must return that response.
  - If admin: return `{ email }`.
- [ ] **1.7.5** (Optional) Replace hardcoded admin arrays in `app/landing/page.tsx` and `app/components/admin_page.tsx` with an import from `lib/admin-auth.ts` (e.g. a getter or the same list) so there is a single source of truth.

---

### Sprint 1 Done

- All new coins service methods work with existing collections.
- Defaults when `CoinsStatus` is missing: `OFF`, `messageCost=1`, `starterBalance=20`.
- Admin auth is centralized and ready to use in routes.

---

## Sprint 2: API Layer – Billing & Admin Protection

**Goal:** Enforce billing in `/api/responses/messages`, protect coins/balance mutation and “all” read endpoints with admin auth, and define the 402 insufficient-coins contract.

**Deliverables:**
- `ChatRequestDto` and messages route accept `userEmail`; billing runs before OpenAI.
- `GET /api/users/coins?all=1` and `POST /api/users/coins` and `POST /api/users/balance` require admin.
- `GET /api/users/coins?status=1` stays public.
- 402 response shape defined and returned when balance is insufficient.

---

### 2.1 Contract: userEmail and 402 shape

- [x] **2.1.1** In `lib/openai/contracts.ts`, add to `ChatRequestDto`: `userEmail?: string`.
- [x] **2.1.2** In a shared place (e.g. `lib/coins.ts` or `lib/errors.ts`), define the 402 body type and a helper:
  - Shape: `{ error: 'INSUFFICIENT_COINS'; message: 'Not enough coins'; balance: number; required: number }`.
  - Helper e.g. `insufficientCoinsResponse(balance: number, required: number): NextResponse` returning status 402 and JSON body.

---

### 2.2 Billing in /api/responses/messages

- [x] **2.2.1** In `app/api/responses/messages/route.ts`, at the start of the POST handler (before any OpenAI call):
  - Parse body and read `userEmail` (optional).
  - Call coins service `getCoinsConfig()`.
  - If config `status !== 'ON'`: skip billing and continue to existing OpenAI flow.
- [x] **2.2.2** When `status === 'ON'`:
  - If `!userEmail`, return `400` with a clear message (e.g. "userEmail required when coins are ON").
  - Call `chargeMichaelMessage(userEmail)`.
  - If result `ok: false`: return the 402 response using the helper from 2.1.2 with `result.balance` and `result.required`.
  - If `ok: true`: proceed with the existing OpenAI request (no refund on stream failure in MVP).
- [x] **2.2.3** Ensure the request body type used in the route includes `userEmail` (align with `ChatRequestDto`).

---

### 2.3 Protect GET /api/users/coins (all=1 only)

- [x] **2.3.1** In `app/api/users/coins/route.ts` GET:
  - When `all === '1'`: call `requireAdmin(request)` (or equivalent). If not admin, return 403 and do not return coins list.
  - When `status === '1'`: do not require admin; keep current behavior (return normalized status only).
- [x] **2.3.2** Ensure `GET` without `all=1` and without `status=1` still returns 400 as today.

---

### 2.4 Protect POST /api/users/coins

- [x] **2.4.1** At the top of POST handler in `app/api/users/coins/route.ts`: call `requireAdmin(request)`. If not admin, return 403.
- [x] **2.4.2** (Optional for this sprint) Migrate POST body handlers to use new service methods:
  - For `body.newStatus`: call `setCoinsConfig({ status: body.newStatus }, adminEmail)` instead of `setCoinsStatus(body.newStatus)`.
  - For `body.users` + `body.amount`: call `adjustBalanceAdmin(body.users, body.amount, adminEmail)`.
  - If you keep calling existing `setCoinsStatus` / `updateCoinsBalance`, ensure they still work with the new CoinsStatus shape (e.g. `setCoinsStatus` should set only `status` and optionally `updatedAt`/`updatedBy` via `setCoinsConfig`).

---

### 2.5 Protect POST /api/users/balance

- [x] **2.5.1** In `app/api/users/balance/route.ts` POST: call `requireAdmin(request)`. If not admin, return 403.
- [x] **2.5.2** Keep GET behavior for now (student will use GET to refresh balance). Decide if GET should stay public or require the requesting user to match `email`; for MVP, keeping GET public with `?email=...` is acceptable if documented.
- [x] **2.5.3** Document that chat must not use POST `/api/users/balance` for charging; charging is done only in `/api/responses/messages`.

---

### Sprint 2 Done

- Billing is server-side; when coins are ON, one message costs 1 coin and 402 is returned when balance is insufficient.
- Coins mutation and “all” list are admin-only; status-only read remains public.

---

## Sprint 3: Chat Frontend – userEmail, No Client Charge, 402, Polling

**Goal:** Chat sends `userEmail`, stops doing authoritative client-side balance updates, handles 402 with a clear Hebrew message, and polls balance/status when coins are ON.

**Deliverables:**
- `/api/responses/messages` request body includes `userEmail` from stored user.
- No client-side balance decrement before the request; balance is authoritative from server.
- 402 response shows a clear Hebrew message; optional balance refresh after success.
- When coins are ON: balance and status polled (e.g. every 10s); when OFF, hide balance and stop polling.

---

### 3.1 Send userEmail and remove client-side charge

- [x] **3.1.1** In `app/components/chat.tsx`, locate the `fetch('/api/responses/messages', ...)` call (around line ~1638). Add to the JSON body: `userEmail: storedUser?.email ?? undefined` (use the same `storedUser` / `userEmail` you already have in scope).
- [x] **3.1.2** Remove the authoritative client-side balance update: delete or comment the lines that call `updateUserBalance(currentBalance - estimatedCost)` and `setCurrentBalance(currentBalance - estimatedCost)` before the fetch. Do not decrement balance on the client; the server will charge.
- [x] **3.1.3** Ensure `updateUserBalance` is not used for “charging” anymore. If it’s still used to persist the balance in localStorage after a server response or after a balance poll, keep that usage; otherwise you can remove or refactor it so it only updates from server data.

---

### 3.2 Handle 402 INSUFFICIENT_COINS

- [x] **3.2.1** After `fetch('/api/responses/messages')`, if `response.status === 402`:
  - Parse JSON body and check for `error === 'INSUFFICIENT_COINS'` (and optionally `balance`, `required`).
  - Show a clear Hebrew message to the user, e.g. "אין מספיק מטבעות. יתרה: X, נדרש: Y" or "אין מספיק מטבעות. נסה שוב אחרי שתתעדכן היתרה." Do not start the stream.
  - Set balance state from response if you want (e.g. `setCurrentBalance(body.balance)`).
  - Re-enable input and any loading state.
- [x] **3.2.2** Optionally: on successful response start (e.g. when you get first chunk or 200), trigger one balance refresh (e.g. call GET `/api/users/balance?email=...` and update `currentBalance`) so the UI updates soon without waiting for the next poll.

---

### 3.3 Balance visibility and polling when coins ON

- [x] **3.3.1** Keep existing logic that shows/hides balance based on coins status (`isTokenBalanceVisible` from `GET /api/users/coins?status=1`). When status is OFF: hide balance UI and do not run balance polling.
- [x] **3.3.2** When coins are ON:
  - Start a polling interval (e.g. every 10 seconds): call `GET /api/users/balance?email=<storedUser.email>` and update `setCurrentBalance` from the response. Normalize response (if it’s array/object, take the numeric balance field).
  - Also poll or refresh coins status (e.g. same 10s or separate 10s) so that if admin turns coins OFF, the client stops showing balance and stops polling.
- [x] **3.3.3** On unmount or when user logs out, clear the interval(s).
- [x] **3.3.4** Initial load: already loading balance from localStorage and status from `GET /api/users/coins?status=1`. When status is ON, also fetch current balance from GET `/api/users/balance?email=...` once so the displayed balance is server-authoritative.

---

### 3.4 Uncomment/use balance error UI if needed

- [x] **3.4.1** If there is commented-out balance error UI (e.g. “No enough tokens”), wire it to the 402 flow: when you get 402, set a balance-error state and show the Hebrew message (in the same or a similar component). Clear the error after a few seconds or on next successful send.

---

### Sprint 3 Done

- Chat sends `userEmail`; server is the single source of truth for charging.
- 402 is handled with a clear Hebrew message; balance can refresh after success and on a 10s poll when coins are ON.

---

## Sprint 4: Admin UI – Config, Headers, Polling

**Goal:** Admin page uses full coins config (load/save), sends admin email header on coins mutations, and polls users/balances every 5s. Optional: centralize toggle/update logic.

**Deliverables:**
- Admin toggle and “add coins” flows work with the new API; admin email sent in headers.
- Admin view refreshes balances every 5s; coins list/status refreshes every 5s.
- Admin can still see balances when feature is OFF (operational visibility).

---

### 4.1 Load and save full coins config (admin)

- [x] **4.1.1** Where the admin page loads coins status (e.g. “מטבעות וירטואליים” toggle), ensure you can load the full config when needed. For MVP, loading `GET /api/users/coins?status=1` is enough for the toggle; if you add future fields (messageCost, starterBalance), add a dedicated config endpoint or reuse a safe admin-only endpoint that returns full config.
- [x] **4.1.2** When saving “coins ON/OFF”, call `POST /api/users/coins` with `{ newStatus: 'ON' | 'OFF' }` and send header `x-user-email` or `x-admin-email` with the current admin user’s email (from localStorage or your existing admin user state). Use the same allowlist source as `lib/admin-auth.ts` so the backend accepts the request.

---

### 4.2 Send admin email on all coins mutations

- [x] **4.2.1** For every `fetch` to `POST /api/users/coins` (toggle or add coins): add header `x-user-email: <adminEmail>` (or `x-admin-email`). Use the same admin user identity you use for the rest of the admin page.
- [x] **4.2.2** For every `fetch` to `POST /api/users/balance`: add the same admin header so the route can allow the request. (N/A in current admin UI: no admin-side `POST /api/users/balance` call exists.)

---

### 4.3 Polling on admin page

- [x] **4.3.1** On the admin users/coins view, start a polling interval (e.g. 5 seconds): refresh the list of users and their coins (e.g. `GET /api/users/coins?all=1` with admin header). Update the UI with the response.
- [x] **4.3.2** Ensure the admin header is sent with `GET /api/users/coins?all=1` (e.g. `x-user-email` or `x-admin-email`) so the backend accepts the request.
- [x] **4.3.3** When the admin navigates away from the coins view or the component unmounts, clear the interval.
- [x] **4.3.4** Keep showing admin balance visibility even when coins feature is OFF (so admins can still add coins and see balances).

---

### 4.4 Optional cleanup

- [ ] **4.4.1** If there are duplicate `updateCoinsStatus` or similar calls from multiple handlers in the admin page, centralize into one function that calls `POST /api/users/coins` with the right body and headers.

---

### Sprint 4 Done

- Admin can toggle ON/OFF and add coins; all mutations and “all” read are authenticated with admin email header.
- Admin view refreshes every 5s; behavior is unchanged when feature is OFF except that backend now enforces ON/OFF and billing.

---

## Sprint 5: Testing & Acceptance

**Goal:** Automated tests for coins service and API behavior; manual checks for UI; regression checks.

**Deliverables:**
- Unit tests for config defaults, seed balance, charge success/fail, bypass when OFF.
- API tests for status public, all=1 admin-only, POST coins/balance admin-only, messages 402 when ON and no charge when OFF.
- Manual (or targeted) checks for student/admin UI and regression.

---

### 5.1 Unit tests (lib/coins or dedicated test file)

- [x] **5.1.1** Test: when `CoinsStatus` doc is missing, `getCoinsConfig()` returns default status OFF (or your default), messageCost 1, starterBalance 20.
- [x] **5.1.2** Test: `getOrCreateUserBalance(email)` for unknown email creates a row with starterBalance (e.g. 20) and returns it.
- [x] **5.1.3** Test: `chargeMichaelMessage(email)` when balance >= 1 decrements by 1 and returns `ok: true`.
- [x] **5.1.4** Test: `chargeMichaelMessage(email)` when balance < 1 returns `ok: false` with `balance` and `required`.
- [x] **5.1.5** Test: when config status is OFF, `chargeMichaelMessage` returns `ok: true` without decrementing.

---

### 5.2 API route tests

- [x] **5.2.1** `GET /api/users/coins?status=1`: returns 200 and normalized status (e.g. `{ status: 'ON' | 'OFF' }`); no auth required.
- [x] **5.2.2** `GET /api/users/coins?all=1`: without admin header returns 403; with valid admin header returns 200 and list.
- [x] **5.2.3** `POST /api/users/coins`: without admin header returns 403; with admin header and `{ newStatus }` or `{ users, amount }` returns success.
- [x] **5.2.4** `POST /api/users/balance`: without admin header returns 403; with admin header and valid body returns success.
- [x] **5.2.5** `POST /api/responses/messages`: when coins ON and balance sufficient, returns 200 (or stream start); when coins ON and balance insufficient, returns 402 with body `error: 'INSUFFICIENT_COINS'`, `balance`, `required`.
- [x] **5.2.6** `POST /api/responses/messages`: when coins OFF, does not require userEmail and does not return 402 for balance.

---

### 5.3 Manual / UI checks

- [ ] **5.3.1** Coins OFF: student balance UI hidden; Michael works; no charging.
- [ ] **5.3.2** Coins ON: student sees balance; balance refreshes periodically (e.g. 10s); after sending a message, balance decreases (after poll or refresh).
- [ ] **5.3.3** Coins ON and balance 0: sending a message shows clear Hebrew insufficient-coins message; no stream.
- [ ] **5.3.4** Admin: toggle ON/OFF persists and affects student behavior after next status poll; admin can add coins to a user and see updated balance after polling.
- [ ] **5.3.5** New user (no coins row): first message when ON seeds 20 coins and charges 1; balance shows 19.

---

### 5.4 Regression

- [x] **5.4.1** Michael works normally when coins are OFF (no 402, no missing userEmail errors).
- [ ] **5.4.2** Existing login/balance flow still populates `currentBalance` (or equivalent) without errors.
- [ ] **5.4.3** Admin page loads even when no `CoinsStatus` doc exists (defaults applied).

---

### Sprint 5 Done

- MVP acceptance criteria from `coins.md` are met and tests document behavior. You can then lock the branch and iterate on Phase 2 (ledger, rules engine) when ready.

---

## Acceptance Criteria (Checklist)

- [ ] Admin can toggle coins ON/OFF from admin settings; change is server-enforced.
- [ ] When OFF: Michael not charged; student balance UI hidden.
- [ ] When ON: each Michael message costs 1 coin server-side; users without a row get 20 coins.
- [ ] Insufficient balance: request blocked with 402 and user-visible Hebrew message.
- [ ] Admin can add coins to selected user(s); updates visible via polling.
- [ ] Coins mutation and “all” APIs are admin-protected; status-only read is public.
- [ ] Student balance polls every 10s when ON; admin list/balances poll every 5s.

---

## File Reference (Quick Index)

| Area | Files |
|------|--------|
| Service & config | `lib/coins.ts` |
| Admin auth | `lib/admin-auth.ts` (new) |
| Contracts | `lib/openai/contracts.ts` |
| Messages API | `app/api/responses/messages/route.ts` |
| Coins API | `app/api/users/coins/route.ts` |
| Balance API | `app/api/users/balance/route.ts` |
| Chat UI | `app/components/chat.tsx` |
| Admin UI | `app/components/admin_page.tsx` |
| Tests | `__tests__/api/coins.lib.test.ts` or similar |
