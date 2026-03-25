# Coins Feature Implementation Plan

## Goal
- Expand the existing coins system into a real product feature with admin control per surface.
- Add a dedicated admin dashboard called `מטבעות`.
- Support separate enable/disable controls for:
  - Main chat
  - Homework module
- Make charging rules simple and explicit:
  - Main chat message = `1` coin when enabled
  - `תרגול SQL` popup usage = `1` coin when opened/started
  - Homework hint popup = `1` coin when user clicks `הצג רמז`

## Current Repo State
- Coins service already exists in [`lib/coins.ts`](/Users/orperetz/Documents/shenkar/sql-chatbot/lib/coins.ts).
- Coins API already exists in [`app/api/users/coins/route.ts`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/api/users/coins/route.ts).
- Chat billing is already enforced server-side in [`app/api/responses/messages/route.ts`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/api/responses/messages/route.ts).
- Admin UI currently has a general virtual coins toggle inside [`app/components/admin_page.tsx`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/components/admin_page.tsx).
- Homework runner UI lives in [`app/homework/runner/[setId]/RunnerClient.tsx`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/homework/runner/[setId]/RunnerClient.tsx).
- Practice popup already exists in [`app/components/PracticeModal.tsx`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/components/PracticeModal.tsx).

## Product Decisions
- Coins config should no longer be one global `ON/OFF` only.
- Admin must control feature flags by surface:
  - `mainChat`
  - `homeworkHints`
  - `sqlPractice`
- Keep one shared user balance.
- Charging must stay server-authoritative. UI can display balances and errors, but must not be trusted for billing.
- Homework hint content can be placeholder text for now.
- Admin dashboard should include operational data, not just a toggle:
  - current balance
  - total usage
  - usage by feature
  - last activity if available
  - manual add/reduce action

## Required Data Model Changes

### Coins config
- Extend the config document in [`lib/coins.ts`](/Users/orperetz/Documents/shenkar/sql-chatbot/lib/coins.ts).
- Replace the current single `status` meaning with surface-based config.

Suggested shape:

```ts
type CoinsFeatureStatus = "ON" | "OFF";

interface CoinsConfigDoc {
  sid: "admin";
  status: CoinsFeatureStatus; // keep for backwards compatibility if needed
  starterBalance: number;
  costs: {
    mainChatMessage: number;
    sqlPracticeOpen: number;
    homeworkHintOpen: number;
  };
  modules: {
    mainChat: boolean;
    homeworkHints: boolean;
    sqlPractice: boolean;
  };
  updatedAt: Date;
  updatedBy?: string;
}
```

Rules:
- `modules.mainChat = true` means chat messages cost coins.
- `modules.homeworkHints = true` means hint button is visible and charged.
- `modules.sqlPractice = true` means SQL practice popup is allowed and charged.
- Default all modules to `false` for safe rollout.
- Default all costs to `1`.

### Usage tracking
- Current code stores balances only.
- Add usage tracking so the admin table can show analytics.

Recommended new collection:
- `CoinTransactions` or `CoinsLedger`

Suggested event shape:

```ts
interface CoinTransaction {
  _id?: any;
  user: string;
  delta: number;
  reason:
    | "main_chat_message"
    | "sql_practice_open"
    | "homework_hint_open"
    | "admin_adjustment_add"
    | "admin_adjustment_reduce";
  source: "main_chat" | "sql_practice" | "homework" | "admin";
  metadata?: Record<string, unknown>;
  createdAt: Date;
  createdBy?: string;
}
```

Why:
- The admin request includes “usage, analysis, etc”.
- That is not reliable if balance is the only stored state.
- Ledger events also make future reporting and debugging easier.

## Sprint Plan

### Sprint 1: Config and Backend Foundations
Goal:
- Upgrade the coins system so it can support per-feature enable/disable and consistent charging logic.

Tasks:
- Update [`lib/coins.ts`](/Users/orperetz/Documents/shenkar/sql-chatbot/lib/coins.ts):
  - add module-level config
  - add per-action costs
  - keep backward compatibility with existing `status`
  - add helper methods such as:
    - `getCoinsConfig()`
    - `setCoinsConfig()`
    - `chargeMainChatMessage()`
    - `chargeSqlPracticeOpen()`
    - `chargeHomeworkHintOpen()`
    - `adjustBalanceAdmin()`
    - `logCoinTransaction()`
- Add ledger persistence:
  - either extend `COLLECTIONS` with a new transactions collection
  - or add a dedicated service file if separation is cleaner
- Extend [`app/api/users/coins/route.ts`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/api/users/coins/route.ts):
  - `GET ?status=1` should return the full config, not only one `status`
  - `GET ?all=1` should return balances plus summary stats if feasible
  - `POST` should allow:
    - updating module toggles
    - updating costs
    - admin add/reduce balance
- Keep admin auth on all mutation and full-data routes.

Definition of done:
- Admin API can read/write full coins config.
- System can charge different actions by reason.
- Each successful charge creates a transaction row.

Todo:
- [x] Define final config schema
- [x] Add default values and normalization
- [x] Add ledger collection and types
- [x] Add per-action charge helpers
- [x] Extend coins API request/response shapes
- [x] Update or add tests for config normalization and charging

### Sprint 2: Main Chat Charging Fix
Goal:
- Make main chat cost exactly `1` coin per message when enabled.

Tasks:
- Review current behavior in [`app/api/responses/messages/route.ts`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/api/responses/messages/route.ts).
- Replace any old logic tied to message length with fixed-cost charging.
- Use `modules.mainChat` and `costs.mainChatMessage`.
- Keep behavior:
  - if disabled, no charge
  - if enabled and balance insufficient, return `402`
- Review client handling in [`app/components/chat.tsx`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/components/chat.tsx):
  - keep balance refresh from server
  - show a clear Hebrew error on insufficient balance
  - do not decrement locally before server approval

Definition of done:
- One sent chat message costs one coin, regardless of message length.
- Server is the only authority for charging.

Todo:
- [x] Verify old length-based behavior is fully removed
- [x] Use fixed-cost helper for chat billing
- [x] Keep insufficient coins error contract stable
- [x] Add/adjust tests in [`__tests__/api/responses.test.ts`](/Users/orperetz/Documents/shenkar/sql-chatbot/__tests__/api/responses.test.ts)

### Sprint 3: Admin `מטבעות` Dashboard
Goal:
- Build a dedicated admin area for coins management instead of a single generic toggle.

Tasks:
- Add a new admin route, preferably:
  - [`app/admin/coins/page.tsx`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/admin/coins/page.tsx)
  - plus a CSS module if needed
- Add entry point from existing admin navigation:
  - [`app/components/admin/AdminDashboard.tsx`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/components/admin/AdminDashboard.tsx)
  - and/or [`app/components/admin_page.tsx`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/components/admin_page.tsx)
- Dashboard sections:
  - feature toggles:
    - main chat
    - homework hints
    - SQL practice
  - pricing:
    - message cost
    - hint cost
    - SQL practice cost
  - starter balance
  - users table
  - manual balance adjustment
- Users table columns:
  - user name
  - email
  - current balance
  - total spent
  - chat usage count
  - SQL practice usage count
  - homework hint usage count
  - last usage date
- Add manual actions:
  - add coins
  - reduce coins
  - optionally quick presets like `+1`, `+5`, `+10`

UX requirements:
- Use Hebrew labels consistently.
- Make the page operational, not decorative.
- Separate config panel from user analytics panel.
- If analytics queries are expensive, start with server-side aggregation and paginate the table.

Definition of done:
- Admin has one clear `מטבעות` screen.
- Feature toggles are no longer buried in generic settings only.
- Admin can inspect balances and manage users from one place.

Todo:
- [x] Create new admin route for coins
- [x] Add nav link/card into admin
- [x] Build config panel
- [x] Build users table
- [x] Add add/reduce coins actions
- [x] Add loading, empty, and error states

### Sprint 4: Homework Hint Flow
Goal:
- Add a `הצג רמז` button in homework that opens a popup and charges one coin when enabled.

Tasks:
- Implement hint CTA inside [`app/homework/runner/[setId]/RunnerClient.tsx`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/homework/runner/[setId]/RunnerClient.tsx).
- Show the button only when:
  - coins feature for homework hints is enabled
  - user is allowed to use coins
- Add popup/modal flow:
  - title: `רמז`
  - placeholder content for now
  - clear close action
- Add server endpoint for hint usage billing, recommended new route:
  - [`app/api/homework/hints/route.ts`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/api/homework/hints/route.ts)
- The endpoint should:
  - validate user
  - check `modules.homeworkHints`
  - charge `costs.homeworkHintOpen`
  - log ledger transaction
  - return placeholder hint payload

Suggested placeholder response:

```json
{
  "hint": "רמז לדוגמה: נסו להתחיל מזיהוי הטבלאות הרלוונטיות ולבדוק אילו עמודות דרושות לפתרון."
}
```

Definition of done:
- Homework runner shows `הצג רמז` when feature is enabled.
- Clicking it opens a popup only after successful billing.
- User sees a meaningful insufficient-balance message if needed.

Todo:
- [x] Design button placement in runner header or question area
- [x] Add server endpoint for billed hint opening
- [x] Add modal component or reuse existing modal pattern
- [x] Add placeholder hint text
- [x] Add tests for enabled/disabled/insufficient-balance flows

### Sprint 5: SQL Practice Charging and UI Refresh
Goal:
- Make `תרגול SQL` cost `1` coin and improve the popup design so it matches the system.

Tasks:
- Inspect current practice flow in:
  - [`app/components/chat.tsx`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/components/chat.tsx)
  - [`app/components/PracticeModal.tsx`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/components/PracticeModal.tsx)
- Add server-side charge before opening or starting practice.
- Recommended new route:
  - [`app/api/practice/coins/route.ts`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/api/practice/coins/route.ts)
- Billing behavior:
  - charge once per practice session open/start
  - do not charge per step inside the popup
- UI/UX improvements for the popup:
  - align spacing, typography, and buttons with current system
  - improve header hierarchy
  - unify colors with existing admin/chat visual language
  - remove any rough MVP feel
  - support mobile cleanly

Product rule:
- If `modules.sqlPractice` is off:
  - either hide the menu item entirely
  - or disable it with helper text
- Prefer hiding if the current product style already hides unavailable actions.

Definition of done:
- Opening SQL practice costs one coin when enabled.
- Popup looks consistent with the rest of the app.

Todo:
- [x] Add practice billing endpoint/helper
- [x] Wire billing before popup content flow
- [x] Show insufficient-balance message in chat area or modal
- [x] Refresh popup layout and styling
- [x] Validate desktop and mobile states

### Sprint 6: Analytics, Admin Table, and Polish
Goal:
- Turn the coins screen into a usable admin tool with reporting and clean UX.

Tasks:
- Add server aggregation for admin users table:
  - total spent
  - usage count by source
  - last usage
- If needed, add dedicated admin analytics route:
  - [`app/api/admin/coins/analytics/route.ts`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/api/admin/coins/analytics/route.ts)
- Improve student-facing balance updates:
  - refresh after successful spend
  - keep existing polling if useful
- Standardize Hebrew copy:
  - `אין מספיק מטבעות`
  - `המטבעות התווספו בהצלחה`
  - `המטבעות הופחתו בהצלחה`
  - `הרמז נפתח בהצלחה`
- Add edge-case handling:
  - no balance row
  - admin reduces below zero
  - duplicate click on hint/practice button
  - stale config cache

Definition of done:
- Admin dashboard shows real usage information.
- Student UX is clear and consistent across all spend flows.

Todo:
- [x] Add aggregation query or analytics route
- [x] Connect analytics to admin table
- [x] Add action success/error toasts
- [x] Prevent duplicate spend clicks
- [x] Finalize Hebrew UX copy

## API Endpoints to Add or Update

### Update existing
- [`app/api/users/coins/route.ts`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/api/users/coins/route.ts)
  - support full config payloads
  - support admin balance adjustments
  - support admin users analytics response if kept in same endpoint

### Add new
- [`app/api/homework/hints/route.ts`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/api/homework/hints/route.ts)
  - billed hint open endpoint
- [`app/api/practice/coins/route.ts`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/api/practice/coins/route.ts)
  - billed SQL practice open/start endpoint
- [`app/api/admin/coins/analytics/route.ts`](/Users/orperetz/Documents/shenkar/sql-chatbot/app/api/admin/coins/analytics/route.ts)
  - optional dedicated analytics endpoint if table data becomes too heavy

## Testing Plan

### Unit tests
- Extend [`__tests__/api/coins.lib.test.ts`](/Users/orperetz/Documents/shenkar/sql-chatbot/__tests__/api/coins.lib.test.ts):
  - config defaults for all modules
  - charge main chat
  - charge SQL practice
  - charge homework hint
  - bypass when specific module is disabled
  - ledger logging on successful charge

### API tests
- Extend [`__tests__/api/coins.route.test.ts`](/Users/orperetz/Documents/shenkar/sql-chatbot/__tests__/api/coins.route.test.ts):
  - admin can update module toggles
  - admin can update costs
  - admin can add/reduce balance
- Extend [`__tests__/api/responses.test.ts`](/Users/orperetz/Documents/shenkar/sql-chatbot/__tests__/api/responses.test.ts):
  - chat costs one coin
  - no message-length based charge remains
- Add tests for:
  - homework hint billing route
  - SQL practice billing route

### Manual QA
- Main chat:
  - send short message, cost is `1`
  - send long message, still cost is `1`
  - insufficient balance blocks request
- Homework:
  - button hidden when feature disabled
  - button visible when enabled
  - click opens popup and charges one coin
- SQL practice:
  - entry hidden or disabled when feature off
  - opening practice charges one coin
  - popup visuals are aligned with the app
- Admin:
  - can toggle each module independently
  - can add/reduce balance
  - sees usage counters and current balances

## Open Questions to Resolve During Implementation
- Should `sqlPractice` be hidden or disabled when feature is off.
- Should hint opening be charged per question or once per homework session.
- Should admin be allowed to set custom per-feature costs from the UI now, or keep all costs fixed at `1` for this phase.
- Should user analytics be computed live from ledger or cached into summary fields.

Recommended answers for now:
- Hide unavailable actions instead of showing disabled UI.
- Charge homework hint per click on `הצג רמז`.
- Keep admin-editable costs in backend and UI, but default all to `1`.
- Start with live aggregation unless performance becomes an issue.

## Final Acceptance Criteria
- Admin has a dedicated `מטבעות` dashboard.
- Admin can enable/disable coins separately for:
  - main chat
  - homework hints
  - SQL practice
- Main chat costs exactly `1` coin per message when enabled.
- Homework has a `הצג רמז` popup that costs `1` coin when enabled.
- SQL practice costs `1` coin and the popup UI is visually aligned with the rest of the system.
- Admin can add/reduce coins for users.
- Admin dashboard includes user balances and usage analytics.
- All billing is enforced on the server, not only in the client.
