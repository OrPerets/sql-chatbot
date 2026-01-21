# Weekly Analytics Admin Panel (אנלטיקה שבועית) — Implementation Guide

## Goal
Build a descriptive **Weekly Analytics** dashboard for lecturers to analyze student performance, challenges, and usage on a weekly basis. The page should surface:
- **How many users were connected** during the week.
- **Average time** spent per user/session.
- **Messages per user** (and per session).
- **Frequently asked topics** (both conversational and curriculum-specific).
- **Additional analytical measures** to highlight engagement and performance trends.

The new page should live inside the **admin panel** and be accessible from the sidebar.

---

## Existing Infrastructure Review (What to Reuse)

### Admin UI Layout & Navigation
- **Admin shell/layout**: `app/components/admin/AdminLayout.tsx` and `app/components/admin/ModernAdminLayout.tsx`.
- **Sidebar navigation**: `app/components/admin/Sidebar.tsx`.
- **Dashboard style components**:
  - `StatsCard.tsx` for KPI blocks.
  - `SkeletonCard.tsx` for loading states.
  - `ErrorBanner.tsx` for failures.
  - `LoadingSpinner.tsx` for async content.

These are already used in `app/components/admin/ModernDashboard.tsx` and in `app/components/admin_page.tsx`.

### Existing Data Sources (Backend)
- **Weekly chat report**: `GET /api/admin/chat-report?days=7&format=json&includeDetails=true`
  - Provides **total users with sessions**, **total sessions**, **total messages**, **average messages per user**, **average messages per session**.
  - Includes **top topics** and **sample questions** (currently focused on relational algebra keywords).
- **Student analytics**: `GET /api/admin/students/analytics`
  - Provides **score distribution**, **risk distribution**, **average grade**, **average engagement**, **top challenges**.
- **Monitoring metrics**: `GET /api/admin/monitoring?hours=168&type=metrics`
  - Can be used for high-level system health/performance context if needed.

### Existing Admin Pages/Routes
- Admin routes are under `app/admin/*` and rendered via shared admin layout.
- **Examples**: `app/admin/chat-report/page.tsx`, `app/admin/datasets/page.tsx`, `app/admin/databases/page.tsx`.

---

## Proposed Page: `/admin/weekly-analytics`

### Page Summary
A weekly analytics dashboard with a lecturer-focused narrative, combining **usage data** (engagement), **student performance** (risk/score), and **topics** (frequent questions and pain points).

### Core Sections
1. **Weekly KPIs (Top Row)**
   - Total users connected this week
   - Total sessions
   - Total messages
   - Average messages per user
   - Average messages per session

2. **Engagement & Time Metrics**
   - Average session duration (if available)
   - Median session duration (if available)
   - Active days count (days with any sessions)
   - Returning users percentage

3. **Topic Insights**
   - Top topics list (from chat-report top topics)
   - “Frequently Asked Topics” breakdown
   - Sample questions list (with user + timestamp)

4. **Student Performance Summary**
   - Score distribution (good / needs attention / struggling)
   - Risk distribution (low / medium / high)
   - Average grade
   - Top challenges (from student analytics)

5. **Daily Breakdown (Chart/Table)**
   - For each day: sessions, messages, unique users

6. **Optional: Alerts/Anomalies**
   - High-risk students spike
   - Low engagement week detection

---

## Data Design Notes

### Weekly Report Data
Source: `/api/admin/chat-report?days=7&format=json&includeDetails=true`
- **Summary**:
  - `totalUsersWithSessions`
  - `totalSessions`
  - `totalMessages`
  - `averageMessagesPerUser`
  - `averageMessagesPerSession`
- **Topics**:
  - `relationalAlgebra.topTopics`
  - `relationalAlgebra.sampleQuestions`
- **Daily breakdown**:
  - `dailyBreakdown[]` includes `date`, `sessions`, `messages`, `uniqueUsers`.

### Student Analytics Data
Source: `/api/admin/students/analytics`
- `scoreDistribution`
- `riskDistribution`
- `averageGrade`
- `averageEngagement`
- `topChallenges`

### Time Metrics Gap (Average Time)
No existing endpoint currently provides session duration. Two options:
1. **Quick v1**: derive approximate session length using `createdAt` + `lastMessageTimestamp` from `chat_sessions`.
2. **v2**: store explicit duration in analytics collection in `lib/monitoring` or a new aggregation job.

---

## Implementation Plan: Sprints & Deliverables

### Sprint 1 — Baseline Weekly Analytics Page
**Deliverable:** `/admin/weekly-analytics` route with KPI cards and basic tables.

**Todo List:**
- [x] Create `app/admin/weekly-analytics/page.tsx`.
- [x] Use `AdminLayout` or `ModernAdminLayout` for consistent admin shell.
- [x] Fetch `chat-report` data for the last 7 days.
- [x] Render **KPI cards** using `StatsCard`.
- [x] Add **daily breakdown table** with sessions/messages/users.
- [x] Add **basic topics list** (top topics).
- [x] Add loading + error states (`SkeletonCard`, `ErrorBanner`).

**Implementation Notes:**
- The weekly analytics page is implemented under `/admin/weekly-analytics` with KPI cards, daily breakdown, and top topics pulled from the weekly chat report endpoint.
- The sidebar now links directly to the new weekly analytics route for quick access from the admin navigation.
- Sprint 1 focuses on usage metrics only; session-duration KPIs remain deferred until backend support is available.

### Sprint 2 — Topic Insights + Performance Summary
**Deliverable:** Dashboard with topic insights and student analytics.

**Todo List:**
- [x] Fetch `students/analytics` data alongside chat report.
- [x] Add **student performance summary** section (score + risk distributions).
- [x] Add **top challenges** list.
- [x] Add **sample questions** panel (with timestamp/user where available).
- [x] Create reusable sub-components (TopicList, PerformanceSummary).

**Implementation Notes:**
- The weekly analytics page now fetches student analytics in parallel with the chat report, with dedicated loading/error handling for each data source.
- Topic insights include both a reusable topic list and a sample questions panel that surfaces the user identifier and timestamp.
- Student performance highlights averages, score/risk distributions, and a dedicated top-challenges list to round out Sprint 2.

### Sprint 3 — Average Time & Engagement Measures
**Deliverable:** Time-based engagement metrics.

**Todo List:**
- [x] Add aggregation in backend to calculate **session duration** (createdAt → lastMessageTimestamp).
- [x] Extend `chat-report` response with:
  - `averageSessionDuration`
  - `medianSessionDuration`
  - `averageUserDuration`
- [x] Update UI to show time KPIs (Avg time per session/user).
- [x] Add “returning user %” if data can be derived from user activity history.

**Implementation Notes:**
- The chat-report API now calculates per-session durations based on createdAt and lastMessageTimestamp, returning average/median session length plus average duration per user for the reporting window.
- Returning user percentage is derived by checking whether weekly users had sessions created before the reporting period.
- The weekly analytics UI includes a dedicated engagement section that surfaces the new time-based KPIs and returning user ratio alongside existing weekly metrics.

### Sprint 4 — Lecturer Insights + Alerts
**Deliverable:** Highlight risks/anomalies for lecturers.

**Todo List:**
- [x] Add anomaly detection thresholds (e.g., high-risk share > 20%).
- [x] Add **alerts panel** (warning cards for lecturers).
- [x] Add export button for CSV/Excel (optional).
- [x] Add filters (week selector, class/semester filter).

**Implementation Notes:**
- Added a lecturer alerts section that flags high-risk share, low engagement, low returning users, and short sessions using configured thresholds derived from weekly report + student analytics.
- Added filter controls for time range, class, and semester; selections are now forwarded as query parameters to reporting endpoints and the weekly report respects the selected range.
- Added a CSV export action to download the weekly summary, daily breakdown, and student analytics snapshot in one file.

### Sprint 5 — Usage Comprehension & Actionable Analytics
**Deliverable:** Make the dashboard more informative with usage comprehension, segmentation, and actionable takeaways.

**Todo List:**
- [ ] Add **usage funnel** (visit → first question → follow‑up → assignment completion).
- [ ] Add **cohort/segment views** (new vs returning, course group, language).
- [ ] Add **retention view** (D1/D7 repeat usage or weekly returning trend).
- [ ] Add **message density + topic depth** metrics (avg thread length, follow‑up ratio).
- [ ] Add **time‑of‑day & day‑of‑week heatmap** (peak usage windows).
- [ ] Add **curriculum mapping** (topics mapped to course chapters/learning outcomes).
- [ ] Add **action insights** section with “next best actions” (e.g., topics to review in class).
- [ ] Add **metric validation rules** (cap impossible durations, exclude outliers, flag anomalies).
- [ ] Add **at‑risk students definition** helper text (clear threshold + calculation source).

**Implementation Notes:**
- Extend the weekly analytics API to provide funnel counts and cohort flags per user/session.
- Derive heatmap data from session timestamps; bucket by hour and weekday.
- Add curriculum tags in topic extraction and surface “chapter hotspots” for lecturers.
- Summaries should include a short narrative (auto‑generated) describing the week’s usage and anomalies.
- Implement duration sanity checks (e.g., drop sessions with >8h idle gap, cap session length to 2h, and flag averages outside expected ranges).
- Provide an inline tooltip explaining **"קורסים בסיכון"**: percentage of students with risk score ≥ threshold (e.g., 0.7) or grade below cutoff, computed from `/students/analytics`.
- Refine main topics by merging near‑duplicates, grouping by SQL/RA concepts, and adding confidence scores + representative queries.

### Sprint 6 — Advanced Features & Professional Refinements
**Deliverable:** Advanced analysis for power users plus operational readiness.

**Todo List:**
- [ ] Add **comparative insights** (this week vs last week, vs class average).
- [ ] Add **quality signals** (helpful answers rate, resolved/abandoned threads).
- [ ] Add **student journey view** (progression of questions → assessments).
- [ ] Add **exportable reports** (PDF summary + scheduled email digest).
- [ ] Add **admin annotations** (lecturer notes per week/topic).
- [ ] Add **performance guardrails** (cached aggregates, background jobs).

**Implementation Notes:**
- Use scheduled aggregation jobs for weekly rollups to keep dashboard fast.
- Add delta indicators (up/down %) to KPIs and trend lines in charts.
- Provide a “Share” button that generates a report artifact for faculty review.

---

## Suggested UI Structure (Component Layout)

```
AdminLayout
└─ WeeklyAnalyticsPage
   ├─ Header (title + week selector)
   ├─ KPI Row (StatsCard)
   ├─ Engagement Section
   ├─ Topic Insights Section
   ├─ Student Performance Section
   ├─ Daily Breakdown Table/Chart
   └─ Alerts / Summary
```

---

## API Enhancements (If Needed)

### Extend Chat Report with Session Duration
In `app/api/admin/chat-report/route.ts`:
- Add aggregation to compute session durations:
  - duration = `lastMessageTimestamp - createdAt` (for sessions in period)
- Return:
  - `averageSessionDuration`
  - `medianSessionDuration`
  - `averageUserDuration` (sum durations per user / total users)

### Frequent Topics Beyond Relational Algebra
- Update `extractTopicFromMessage()` to include:
  - SQL errors (syntax, joins, GROUP BY, HAVING)
  - Schema misunderstandings
  - Homework-specific tags if message contains `HW`/`Exercise` keywords

---

## Definition of Done (DoD)
- Weekly analytics page accessible from admin sidebar.
- KPI metrics visible at top.
- Topics + challenges surfaced clearly.
- Student performance summary available.
- Loading and error handling present.
- Data-driven, week-based default.

---

## Risks & Considerations
- **Time metrics** require consistency in session timestamps.
- **Topic extraction** can be noisy; consider adding a tagging model later.
- **Performance**: use pagination or limit heavy lists (e.g., sample questions).

---

## Next Steps Checklist
- [ ] Add sidebar entry in `Sidebar.tsx`.
- [ ] Create `WeeklyAnalytics` page route + component.
- [ ] Implement data fetching hooks for chat-report and student analytics.
- [ ] Define sprints in Jira/Notion as per plan above.
