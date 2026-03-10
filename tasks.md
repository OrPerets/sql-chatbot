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

---

# Homework Module Upgrade Plan

## Goal
להפוך את מודול ה־`homework` למערכת יציבה, נוחה לניהול, ותומכת בכמה תרגילי בית פתוחים במקביל, עם חלונות זמינות ברורים, מסלולי כניסה ייעודיים, ותצוגת runner ברורה יותר לסטודנטים.

המסמך הזה מתמקד ביישום מעשי בתוך הקוד הקיים, ולא רק בתיאור מוצר. הוא מתייחס במיוחד לאזורים הבאים:
- `app/homework/start`
- `app/homework/runner/[setId]`
- `app/homework/builder`
- `app/api/homework`
- `lib/homework.ts`
- `app/homework/types.ts`
- בדיקות ב־`__tests__` ו־`tests/e2e`

---

## Product Decisions To Lock Before Coding

### 1. Dedicated student entry path per homework
החלטה מומלצת:
- להשאיר את ` /homework/start ` כדף מרכזי שמציג את כל התרגילים הזמינים כרגע.
- להוסיף נתיב ייעודי ` /homework/start/[setId] ` עבור קישור ישיר לתרגיל ספציפי.
- כל תרגיל יקבל לינק קבוע שאפשר לשתף עם הסטודנטים.

למה:
- פותר את הבעיה של "אפשר רק תרגיל אחד".
- מאפשר לפתוח כמה תרגילים במקביל.
- לא שוברים לינקים קיימים אם שומרים תאימות ל־`?setId=...`.

### 2. Availability window
לכל Homework Set חייבים להיות:
- `availableFrom`
- `availableUntil`

כלל זמינות:
- לפני `availableFrom` התרגיל לא זמין לסטודנט.
- בין `availableFrom` ל־`availableUntil` התרגיל זמין.
- אחרי `availableUntil` התרגיל לא זמין.

החלטה מומלצת:
- `dueAt` יהפוך לשדה legacy בלבד או יוחלף לחלוטין ב־`availableUntil`.
- אם יש תלות קיימת ב־`dueAt`, לשמור תאימות זמנית ולמפות:
  - `availableUntil ?? dueAt`

### 3. Question content model
לכל שאלה צריך להיות מפורש:
- `prompt`: מה השאלה עצמה
- `expectedOutputDescription`: מה הפלט הרצוי

לא להסתפק בשדה חופשי אחד.

### 4. Homework-level data structure explanation
ההסבר על מבנה הנתונים צריך להיות זמין גם בתוך ה־runner, לא רק ב־`/homework/start`.

החלטה מומלצת:
- לשמור את ההסבר ברמת ה־Homework Set או Dataset linkage, ולא רק כטקסט חופשי בתצוגת פתיחה.
- להציג אותו בפאנל הימני מעל רשימת הטבלאות ב־runner.

---

## Current Gaps In The Existing Code

### Data model gaps
- ב־`app/homework/types.ts` יש `dueAt` אך אין `availableFrom` / `availableUntil`.
- אין שדה מסודר עבור `expectedOutputDescription` ברמת שאלה.
- יש `backgroundStory`, אבל אין הבחנה ברורה בין:
  - intro / overview
  - dataset structure explanation
  - student instructions

### Access control gaps
- ב־`lib/deadline-utils.ts` הפונקציה `isHomeworkAccessible()` כרגע תמיד מחזירה `true`.
- אין אכיפה אמיתית של חלון זמן.
- אין סטטוס ברור של homework מסוג:
  - draft
  - scheduled
  - open
  - closed
  - archived

### Student entry gaps
- `StudentEntryClient.tsx` עדיין עובד סביב set selection בסיסי ו־query param.
- אין route ייעודי לכל תרגיל.
- הסינון של תרגילים פתוחים/סגורים חלקי בלבד ומבוסס על `published`.

### Runner UX gaps
- ב־runner אין הצגה ברורה של:
  - הסבר על מבנה הנתונים
  - prompt של השאלה
  - expected output נפרד וברור
- נדרש לחדד את המידע שמופיע באזור העליון של העמודה המרכזית.

### Builder/Admin gaps
- ב־builder יש כרגע `dueAt`, אבל לא טווח זמינות מלא.
- חסר מסך ניהול טוב לראות כמה תרגילים פתוחים במקביל.
- חסרות ולידציות פרסום חזקות לפני publish.

---

## Sprint 1: Data Model And Backend Contracts

### Objective
להניח בסיס יציב ב־types, persistence ו־API כדי לאפשר כמה תרגילים פתוחים במקביל עם חלונות זמינות אמיתיים.

### Tasks

#### 1. Extend HomeworkSet schema
לעדכן את `app/homework/types.ts` ואת המודלים בשרת כך של־HomeworkSet יהיו:
- `availableFrom: string`
- `availableUntil: string`
- `slug?: string` או להשתמש ב־`setId` כנתיב canonical
- `entryMode?: "direct" | "listed" | "hidden"`
- `dataStructureNotes?: string`

DONE:
- הוחלט להשתמש ב־`setId` כנתיב canonical, ללא `slug` בשלב זה.
- נוספו שדות availability / entry mode / data structure notes בצורה backward-compatible ב־types ובמודלי השרת.
- נוספו fallback-ים לרשומות ישנות (`availableUntil ?? dueAt`, ו־`availableFrom` מתוך `createdAt` או ברירת מחדל בטוחה).

#### 2. Extend Question schema
לעדכן את `Question` ב־`app/homework/types.ts`:
- להשאיר `prompt`
- להשאיר/לצמצם `instructions`
- להוסיף `expectedOutputDescription: string`

DONE:
- נוסף `expectedOutputDescription` לשכבת ה־Question וה־API של יצירת שאלות.
- בוצע fallback לרשומות ישנות כדי שלא יישברו שאלות קיימות.
- ההבחנה שנקבעה במימוש:
  - `prompt` = נוסח המשימה
  - `expectedOutputDescription` = מבנה/תיאור הפלט המצופה
  - `instructions` = הנחיות משלימות בלבד

#### 3. Update persistence layer
לעדכן את `lib/homework.ts` ואת כל mapping השכבות:
- create
- read
- update
- list

DONE:
- שכבת ה־persistence עודכנה כך שכל השדות החדשים נשמרים ונשלפים ב־create/read/update/list.
- נוספה שכבת normalization ל־HomeworkSet ול־Question עבור migration logic ורשומות legacy.
- נשמרה תאימות ל־sets קיימים דרך `dueAt` כשדה legacy ממופה ל־`availableUntil`.

#### 4. Replace deadline-only logic with availability window logic
לעדכן `lib/deadline-utils.ts`:
- להחליף `isHomeworkAccessible(dueAt, userEmail)` למודל שעובד עם:
  - `availableFrom`
  - `availableUntil`
  - הארכות פרטניות אם עדיין צריך

DONE:
- נוספו הפונקציות:
  - `getAvailabilityState(homework, userEmail)`
  - `isHomeworkAccessible(homework, userEmail)`
  - `getAvailabilityMessage(homework, userEmail)`
  - `getHomeworkAvailabilityInfo(homework, userEmail)`
- הוגדרו states:
  - `upcoming`
  - `open`
  - `closed`
- נשמרה תמיכה בהארכות פרטניות על סוף חלון הזמינות.

#### 5. Update API contracts
לעדכן:
- `app/api/homework/route.ts`
- `app/api/homework/[setId]/route.ts`

DONE:
- `GET /api/homework` מחזיר availability metadata לכל set.
- `GET /api/homework/[setId]` אוכף גישה לסטודנט לפי חלון זמן, published/archived ו־entry mode.
- builder/admin/instructor עוקפים חסימות זמן וגישה של סטודנטים.
- נוסף filter של `availableOnly=true` עבור "רק תרגילים זמינים כרגע".

### Acceptance Criteria
- [x] אפשר לשמור Homework Set עם `availableFrom` ו־`availableUntil`.
- [x] ה־API מחזיר סטטוס זמינות עקבי.
- [x] Homework סגור אינו נגיש לסטודנט דרך ה־API.
- [x] Homework עתידי אינו נגיש לסטודנט לפני זמן הפתיחה.

---

## Sprint 2: Student Entry Flow And Multi-Homework Support

### Objective
לאפשר כמה תרגילים פתוחים בו־זמנית, עם כניסה דרך דף רשימה ודרך לינק ישיר.

### Tasks

#### 1. Add dedicated route for specific homework
להוסיף:
- `app/homework/start/[setId]/page.tsx`

DONE:
- לטעון את התרגיל הספציפי לפי `setId`.
- להציג הודעת מצב אם התרגיל:
  - טרם נפתח
  - נסגר
  - לא פורסם
  - לא נמצא
- לשמר flow של login ואז entry ל־runner.

Implementation notes:
- נוסף route ייעודי `app/homework/start/[setId]/page.tsx`.
- ה־route טוען את `StudentEntryClient` במצב direct-entry לפי `setId`.
- העמוד מציג הודעת מצב מפורטת עבור:
  - homework עתידי
  - homework סגור
  - homework לא זמין לסטודנטים
  - homework שלא נמצא
- כאשר homework פתוח, ה־flow נשאר: login -> מסך פתיחה/הנחיות -> runner.

#### 2. Upgrade `/homework/start`
לעדכן `app/homework/start/page.tsx` + `app/homework/StudentEntryClient.tsx`

DONE:
- להפוך את הדף לרשימת תרגילים זמינים כרגע.
- להציג לכל כרטיס:
  - שם התרגיל
  - קורס
  - חלון זמינות
  - סטטוס: נפתח בקרוב / פתוח / נסגר
  - כפתור כניסה
- אם יש רק תרגיל אחד פתוח, לא להניח שהוא היחיד בעולם; עדיין להציג מודל אחיד.

Implementation notes:
- `StudentEntryClient` הוסב ממסך בחירה ישן למסך רשימת מטלות עם כרטיסים.
- כל כרטיס מציג:
  - שם המטלה
  - קורס
  - חלון זמינות
  - מספר שאלות
  - סטטוס זמינות
  - כפתור מעבר לעמוד הייעודי
- הסדר ברשימה הוא:
  - open
  - upcoming
  - closed
- גם אם יש רק תרגיל אחד פתוח, עדיין מוצג אותו מודל רשימה אחיד.

#### 3. Keep backward compatibility
DONE:
- לתמוך זמנית גם ב־`/homework/start?setId=...`.
- להפנות בהמשך ל־route החדש.

Implementation notes:
- `app/homework/start/page.tsx` תומך זמנית ב־`?setId=...`.
- בקשה כזו עושה redirect מיידי ל־`/homework/start/[setId]`.
- redirect-ים מתוך ה־runner עודכנו גם הם ל־route החדש.

#### 4. Clarify student-facing messaging
DONE:
- אם homework עוד לא נפתח, להראות תאריך פתיחה מדויק.
- אם homework נסגר, להראות תאריך סגירה מדויק.
- להציג תאריכים בפורמט עברי ברור.

Implementation notes:
- הודעות החסימה לסטודנט נשענות על ה־availability message מה־API.
- חלונות הזמינות מוצגים בפורמט `he-IL` עם תאריך ושעה.
- בעמוד הישיר של מטלה סגורה/עתידית מוצגת גם הודעת מצב וגם חלון הזמינות.

### Acceptance Criteria
- [x] יכולים להיות כמה Homework Sets published/open במקביל.
- [x] לכל אחד יש לינק ייעודי עובד.
- [x] `/homework/start` מציג רשימה אמיתית של available homeworks.
- [x] סטודנט לא נכנס בטעות לתרגיל סגור/עתידי.

---

## Sprint 3: Runner Information Architecture

### Objective
לשפר את חוויית הסטודנט בתוך ` /homework/runner/[setId] ` כך שהמידע הקריטי יופיע במקום הנכון.

### Tasks

#### 1. Add homework data structure explanation above tables
לעדכן:
- `app/homework/runner/[setId]/RunnerClient.tsx`
- `app/homework/runner/[setId]/InstructionsSection.tsx`

DONE:
- להציג בפאנל הימני, מעל רשימת הטבלאות:
  - `dataStructureNotes` או equivalent
- אם אין הסבר ייעודי, להשתמש fallback מתוך `backgroundStory`.
- להפריד ויזואלית בין:
  - הסבר על מבנה הנתונים
  - רשימת הטבלאות

Implementation notes:
- נוסף בלוק "מבנה הנתונים" מעל טבלאות הדוגמה בתוך ה־runner.
- הבלוק משתמש קודם ב־`dataStructureNotes`, ואם הוא חסר מבצע fallback ל־`backgroundStory`.
- לטבלאות נוספה כותרת נפרדת כך שההבחנה בין הסבר מבני לבין נתוני הדוגמה ברורה יותר.

#### 2. Redesign question header area in center column
DONE:
- בחלק העליון של העמודה המרכזית להציג בבירור:
  - מספר שאלה
  - `prompt`
  - `expectedOutputDescription`
  - instructions משלימות אם קיימות
- ה־progress bar לא אמור להיות המקום היחיד לטקסט המשימה.
- ליצור layout עקבי בין כל השאלות.

Implementation notes:
- אזור הכותרת במרכז הוסב לגריד של כרטיסי מידע קבועים לכל שאלה.
- כל שאלה מציגה כעת באופן עקבי:
  - מספר שאלה
  - נוסח המשימה (`prompt`)
  - תיאור הפלט המצופה (`expectedOutputDescription`)
  - הנחיות משלימות אם קיימות
- ה־stepper נשאר רכיב ניווט בלבד.

#### 3. Improve question metadata model in UI
DONE:
- להפסיק להעמיס את כל התוכן לתוך `instructions`.
- לבנות קומפוננטות קטנות:
  - `QuestionPromptCard`
  - `ExpectedOutputCard`
  - `QuestionTipsCard` אם צריך

Implementation notes:
- נוספו קומפוננטות ייעודיות עבור `prompt`, `expected output` ו־`tips`.
- ה־runner בונה כעת את אזור המידע של השאלה מתוך קומפוננטות קטנות וברורות במקום בלוק טקסט יחיד.

#### 4. Improve empty/fallback states
DONE:
- אם חסר `expectedOutputDescription`, להציג placeholder ברור למרצה במצב preview/builder.
- לסטודנט לא להציג UI שבור או ריק.

Implementation notes:
- כאשר `expectedOutputDescription` חסר, נעשה fallback לסכמת התוצאה אם קיימת.
- במצב `student-demo` מוצג placeholder ברור יותר שמאותת למרצה שחסר תיאור פלט מפורש.
- לסטודנט מוצג טקסט fallback שימושי במקום אזור ריק.

### Acceptance Criteria
- [x] הסטודנט רואה בצד ימין גם הסבר על מבנה הנתונים וגם טבלאות.
- [x] הסטודנט רואה במרכז למעלה גם את השאלה וגם את תיאור הפלט הרצוי.
- [x] כל שאלה נראית עקבית וברורה יותר.

---

## Sprint 4: Builder UX And Instructor Workflow

### Objective
להפוך את ה־builder לכלי נוח לניהול אינטנסיבי של כמה תרגילים במקביל לאורך הסמסטר.

### Tasks

#### 1. Add availability fields to builder metadata
לעדכן:
- `app/homework/builder/components/wizard/types.ts`
- `app/homework/builder/components/wizard/MetadataStep.tsx`
- `app/homework/builder/components/wizard/PublishStep.tsx`

DONE:
- להחליף `dueAt` ב־:
  - `availableFrom`
  - `availableUntil`
- להוסיף ולידציה:
  - start < end
  - אי אפשר publish בלי חלון תקין

Implementation notes:
- שכבת ה־draft של ה־builder הוסבה ל־`availableFrom` / `availableUntil`, תוך שמירה על `dueAt` רק כ־payload legacy לשרת.
- נוספה ולידציית client-side שמונעת התקדמות/פרסום כאשר חלון הזמינות חסר או לא תקין.
- מסך הפרסום מציג כעת את חלון הזמינות במקום תאריך הגשה יחיד.

#### 2. Add data structure explanation field in builder
DONE:
- לאפשר למרצה להגדיר בנפרד:
  - intro / overview
  - data structure notes
- להציג preview של איך זה ייראה ב־runner.

Implementation notes:
- נוספה ב־metadata שדה נפרד עבור `dataStructureNotes`.
- ב־metadata step נוסף preview מובנה שמראה את ההבחנה בין פתיח המטלה לבין פאנל "מבנה הנתונים" ב־runner.
- תצוגת ה־preview של המטלה מציגה עכשיו גם את הפתיח וגם את הסבר מבנה הנתונים כפי שהסטודנט יראה אותם.

#### 3. Improve question authoring
DONE:
- לחייב לכל שאלה:
  - `prompt`
  - `expectedOutputDescription`
- להבדיל בטופס העריכה בין:
  - מה הסטודנט צריך לעשות
  - מה הפלט שהוא צריך לקבל
  - הנחיות נוספות

Implementation notes:
- `QuestionDraft` עודכן כך שיכלול `expectedOutputDescription`.
- טופס יצירת השאלות הופרד בפועל לשלושה אזורים: ניסוח המשימה, תיאור הפלט הצפוי, והנחיות משלימות.
- המעבר קדימה והפרסום נחסמים כאשר חסר `prompt`, חסר `expectedOutputDescription`, או אין ניקוד תקין.

#### 4. Improve builder dashboard
לעדכן `app/homework/builder/page.tsx` ואולי גם `app/admin/homework/page.tsx`

DONE:
- להוסיף עמודות/פילטרים:
  - upcoming
  - open
  - closed
  - archived
- להציג:
  - start date
  - end date
  - direct link
  - count submissions
- לאפשר copy link לתרגיל.

Implementation notes:
- לוח הבנייה עבר לסינון לפי סטטוסי availability אמיתיים: `draft`, `upcoming`, `open`, `closed`, `archived`.
- כל כרטיס מציג כעת תאריך פתיחה, תאריך סגירה, ספירת הגשות, ציון ממוצע וקישור ישיר לכניסת הסטודנט.
- נוסף כפתור העתקת קישור ישיר ל־`/homework/start/[setId]`.

#### 5. Publish safety checks
DONE:
- לפני publish לבצע validation summary:
  - יש חלון זמינות תקין
  - יש dataset / tables
  - לכל שאלה יש prompt
  - לכל שאלה יש expected output
  - אין question בלי ניקוד

Implementation notes:
- נוספה שכבת validation מרוכזת ל־builder שמייצרת `blockers` ו־`warnings` לפני פרסום.
- מסך ה־wizard ומסך ה־publish הייעודי משתמשים באותה בדיקת בטיחות כדי למנוע publish לא תקין.
- נוספו בדיקות unit חדשות ל־validation של sprint 4.

### Acceptance Criteria
- [x] מרצה יכול לנהל כמה תרגילים במקביל בלי בלבול.
- [x] ברור מה פתוח עכשיו, מה עתידי ומה נסגר.
- [x] ברור מה הסטודנטים יראו בכל תרגיל.

---

## Sprint 5: Tests, Migration, And Hardening

### Objective
לסגור פינות כדי שהמודול יוכל לשמש בעומס אמיתי לאורך סמסטר.

### Tasks

#### 1. Unit tests
להוסיף/לעדכן:
- `__tests__/homework/homeworkStore.test.ts`
- tests חדשים ל־availability logic

DONE:
- בדיקות ל־open/upcoming/closed.
- בדיקות ל־fallback של `dueAt`.
- בדיקות ל־multi-homework listing.

Implementation notes:
- `__tests__/lib/deadline-utils.test.ts` הורחב כדי לכסות `upcoming`, `open`, `closed`, fallback של `dueAt`, ו־fallback של `createdAt`.
- `__tests__/homework/homeworkStore.test.ts` הורחב כדי לוודא ששכבת ה־mock store שומרת availability fields, `entryMode` ו־`expectedOutputDescription`.
- נוסף גם `__tests__/lib/homework-migration.test.ts` כדי לכסות את ה־backfill logic של migration לנתוני homework legacy.

#### 2. API tests
DONE:
- לבדוק שסטודנט לא מקבל Homework מחוץ לחלון הזמן.
- לבדוק ש־builder כן יכול לטעון לצורך preview/edit.

Implementation notes:
- `__tests__/api/homework.route.test.ts` מכסה כעת:
  - חסימה לסטודנט עבור homework עתידי
  - חסימה לסטודנט עבור homework סגור
  - גישת builder ל־preview/edit גם כאשר homework מחוץ לחלון הזמן
  - החזרת `studentAccess` context כדי להסביר למרצה למה סטודנט חסום

#### 3. E2E tests
לעדכן/להוסיף:
- `tests/e2e/homework-runner.spec.ts`
- `tests/e2e/homework-grading.spec.ts`

DONE:
- תרחיש של שני תרגילים פתוחים במקביל.
- תרחיש של homework עתידי.
- תרחיש של homework סגור.
- תרחיש שבו ב־runner מופיעים:
  - data structure notes
  - prompt
  - expected output

Implementation notes:
- `tests/e2e/homework-runner.spec.ts` הורחב עם mocks ל־`/api/homework` ו־`/api/homework/[setId]` כדי לבדוק באופן דטרמיניסטי:
  - רשימת מטלות עם כמה סטטוסים במקביל
  - direct-entry עבור homework עתידי/סגור
  - נוכחות אזורי `מבנה הנתונים`, `מה צריך לעשות?`, `מה אמור להתקבל?`
- `tests/e2e/homework-grading.spec.ts` נשאר smoke test עבור מסך grading כדי לצמצם regression בזרימת המרצה.

#### 4. Data migration / seed backfill
DONE:
- לקבוע default values ל־homeworks קיימים.
- לכתוב סקריפט migration אם צריך.
- לוודא שלא נעלמים תרגילים ישנים מהדשבורד.

Implementation notes:
- נוסף helper ייעודי ב־`lib/homework-migration.ts` ליצירת ערכי backfill עקביים עבור:
  - `availableFrom`
  - `availableUntil`
  - `dueAt`
  - `entryMode`
- נוסף סקריפט `scripts/backfill-homework-availability.ts` עם dry-run כברירת מחדל ו־`--write` לעדכון בפועל.
- שכבת ה־mock store הוקשחה כדי לשמר את שדות Sprint 1-4 גם בנתוני seed/mock, וכך למנוע "היעלמות" מטלות ישנות בגלל רשומות חלקיות.

#### 5. Observability and admin support
DONE:
- לשפר לוגים עבור access denied בגלל חלון זמן.
- להקל על debugging של "למה הסטודנט לא רואה את התרגיל".

Implementation notes:
- `app/api/homework/[setId]/route.ts` לוגם כעת denied access עם `reason` ו־context מובנה.
- תגובת ה־API כוללת גם `studentAccess` context שמאפשר למרצה/בונה להבין אם החסימה נובעת מ:
  - availability window
  - unpublished
  - archived
  - hidden entry mode

### Acceptance Criteria
- [x] יש כיסוי בדיקות למסלולים הקריטיים.
- [x] אין regression בכניסה, ריצה והגשה.
- [x] אפשר להסביר בקלות למה תרגיל זמין או לא זמין.

---

## Cross-Cutting Refactors

### A. Normalize terminology
להחליט על שמות עקביים:
- `availableFrom` / `availableUntil`
- `dataStructureNotes`
- `expectedOutputDescription`

לא לערבב כמה שמות שונים לאותו רעיון.

### B. Separate student content layers
להפריד בין:
- overview של התרגיל
- הסבר על מבנה הנתונים
- prompt של שאלה
- expected output של שאלה
- instructions משלימות

### C. Reduce hidden logic in free-text fields
כרגע יש יותר מדי לוגיקה שנשענת על טקסט חופשי, כולל transform מיוחד ב־`StudentEntryClient.tsx`.

TODO:
- לצמצם hardcoded transforms.
- להעביר תוכן מובנה לשדות מפורשים.
- לשמור parsing fallback רק לנתונים ישנים.

---

## Suggested Implementation Order

1. Types + DB/service layer
2. Availability utilities + API enforcement
3. Dedicated start route + listing of multiple open homeworks
4. Runner UI restructuring
5. Builder metadata/question forms
6. Dashboard improvements
7. Tests + migration

---

## Definition Of Done

העבודה תיחשב גמורה רק אם כל הסעיפים הבאים מתקיימים:
- יש תמיכה בכמה תרגילי בית פתוחים במקביל.
- לכל תרגיל יש לינק ייעודי עובד.
- לכל תרגיל יש זמן פתיחה וזמן סגירה אמיתיים ומאוכפים.
- ב־runner מופיע הסבר מבנה הנתונים מעל הטבלאות.
- בכל שאלה מופיעים גם נוסח השאלה וגם תיאור הפלט הרצוי.
- builder מאפשר לנהל את כל זה בלי לעקוף ידנית את המערכת.
- יש בדיקות שמכסות את התרחישים הקריטיים.

---

## Nice To Have After Core Delivery

- `slug` אנושי לתרגיל, לא רק `setId`
- duplicate homework / clone previous semester
- bulk schedule publish
- archive automation אחרי סיום חלון
- תצוגת calendar של חלונות תרגילים
- preview as student מתוך builder
