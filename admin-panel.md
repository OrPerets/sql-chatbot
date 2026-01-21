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
- [ ] Fetch `students/analytics` data alongside chat report.
- [ ] Add **student performance summary** section (score + risk distributions).
- [ ] Add **top challenges** list.
- [ ] Add **sample questions** panel (with timestamp/user where available).
- [ ] Create reusable sub-components (TopicList, PerformanceSummary).

### Sprint 3 — Average Time & Engagement Measures
**Deliverable:** Time-based engagement metrics.

**Todo List:**
- [ ] Add aggregation in backend to calculate **session duration** (createdAt → lastMessageTimestamp).
- [ ] Extend `chat-report` response with:
  - `averageSessionDuration`
  - `medianSessionDuration`
  - `averageUserDuration`
- [ ] Update UI to show time KPIs (Avg time per session/user).
- [ ] Add “returning user %” if data can be derived from user activity history.

### Sprint 4 — Lecturer Insights + Alerts
**Deliverable:** Highlight risks/anomalies for lecturers.

**Todo List:**
- [ ] Add anomaly detection thresholds (e.g., high-risk share > 20%).
- [ ] Add **alerts panel** (warning cards for lecturers).
- [ ] Add export button for CSV/Excel (optional).
- [ ] Add filters (week selector, class/semester filter).

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
