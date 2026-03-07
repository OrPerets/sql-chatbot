# Database collections report

Generated: 2026-02-28T05:32:57.840Z

## Summary

| Metric | Value |
|--------|-------|
| Total collections | 39 |
| Known collections (in codebase) | 34 |
| Orphan / unknown collections | 5 |
| Total documents | 138,581 |

---

## Collections

| Collection | Count | Last activity | In codebase | Usage |
|------------|-------|----------------|-------------|-------|
| Coins | 184 | 1/13/2026, 12:52:19 PM | Yes | lib/coins.ts |
| CoinsStatus | 1 | 2/24/2026, 11:58:06 AM | Yes | lib/coins.ts |
| Feedbacks | 49 | 6/12/2025, 10:17:02 AM | Yes | app/api/feedback.ts, scripts/analyze-student-data.ts, scripts/export-michael-usage.ts |
| Status | 1 | 2/23/2025, 12:07:21 PM | Yes | app/api/admin/status/route.ts |
| UserForms | 630 | 1/21/2026, 9:53:36 AM | Yes | app/api/feedback/user-form/route.ts |
| analysis_results | 185 | 1/24/2026, 9:48:04 PM | Yes | lib/ai-analysis-engine.ts, app/api/analysis/insights/route.ts, app/api/analysis/student |
| analytics_events | 0 | — | Yes | scripts/export-homework-1*.ts, scripts/export-michael-usage.ts |
| audit_logs | 0 | — | Yes | lib/models.ts |
| chatMessages | 102,785 | 2/27/2026, 5:40:02 PM | Yes | lib/chat.ts, lib/ai-analysis-engine.ts, scripts/analyze-student-data.ts |
| chatSessions | 1,910 | 2/27/2026, 4:29:02 PM | Yes | lib/chat.ts, scripts/analyze-student-data.ts |
| conversation_summaries | 349 | 2/24/2026, 11:58:08 AM | Yes | scripts/analyze-student-data.ts |
| datasets | 6 | 1/29/2026, 3:27:11 PM | Yes | lib/datasets.ts, lib/data-generation.ts, scripts/migrate-to-database.ts |
| generated_data | 1 | 10/22/2025, 8:47:13 AM | Yes | lib/data-generation.ts, app/api/datasets/[id]/preview-generated/route.ts |
| homework_sets | 2 | 2/22/2026, 8:07:57 AM | Yes | lib/homework.ts, scripts/export-homework-1*.ts, scripts/check-*.ts |
| instantiated_questions | 31 | 10/26/2025, 4:29:44 PM | Yes | lib/template-service.ts, scripts/export-homework-1*.ts |
| ip_rate_limits | 0 | — | Yes | scripts/cleanup-expired-tokens.ts, scripts/setup-database-security.ts |
| learning_annotations | 1 | 1/24/2026, 8:30:58 AM | **No** | — |
| learning_quiz_results | 1 | 1/25/2026, 6:57:53 AM | **No** | — |
| learning_quizzes | 2 | 1/25/2026, 5:36:57 PM | **No** | — |
| learning_summaries | 3 | 1/25/2026, 5:36:18 PM | **No** | — |
| notifications | 0 | — | Yes | lib/notifications.ts, app/api/admin/notifications |
| password_reset_tokens | 32 | 2/27/2026, 6:23:47 PM | Yes | lib/users.ts, scripts/cleanup-expired-tokens.ts, app/api/test-database/route.ts |
| practiceAttempts | 38 | 2/25/2026, 4:10:25 PM | Yes | lib/practice.ts |
| practiceQueries | 66 | 8/30/2025, 8:54:22 AM | Yes | lib/practice.ts |
| practiceTables | 11 | 8/31/2025, 8:49:59 AM | Yes | lib/practice.ts |
| question_analytics | 1,145 | 2/28/2026, 1:44:05 AM | Yes | lib/question-analytics.ts, scripts/export-michael-usage.ts |
| question_templates | 26 | 10/26/2025, 4:39:56 PM | Yes | lib/template-service.ts, scripts/export-homework-1*.ts |
| questions | 146 | 8/7/2025, 12:34:12 PM | Yes | lib/questions.ts, lib/submissions.ts, scripts/export-homework-1*.ts |
| rate_limits | 0 | — | Yes | lib/rate-limiter.ts, scripts/cleanup-expired-tokens.ts, scripts/setup-database-security.ts |
| security_events | 0 | — | Yes | lib/monitoring.ts, scripts/cleanup-expired-tokens.ts, scripts/setup-database-security.ts |
| semester_config | 2 | 2/3/2026, 2:37:21 PM | Yes | lib/content.ts, lib/openai/runtime-config.ts, lib/openai/vector-store.ts |
| student_activities | 30,664 | 2/27/2026, 5:37:39 PM | Yes | lib/activity-tracker.ts, lib/student-profiles.ts, app/api/admin/students/export |
| student_notes | 1 | 1/23/2026, 2:54:04 PM | **No** | — |
| student_profiles | 61 | 1/25/2026, 12:23:10 PM | Yes | lib/student-profiles.ts, lib/activity-tracker.ts, app/api/admin/students |
| submissions | 92 | 2/27/2026, 10:49:14 PM | Yes | lib/submissions.ts, lib/homework.ts, lib/ai-analysis-engine.ts |
| submitted | 57 | 1/14/2026, 7:07:48 AM | Yes | scripts/populate-submitted-collection.ts, scripts/view-submitted-collection.ts, scripts/resend-submission-email.ts |
| userPoints | 1 | 9/17/2025, 3:21:26 PM | Yes | app/api/user-points/route.ts, scripts/analyze-student-data.ts |
| users | 85 | 1/11/2026, 11:45:28 PM | Yes | lib/users.ts, lib/student-profiles.ts, app/api/admin/students |
| weekly_content | 13 | 1/1/2026, 4:27:04 PM | Yes | lib/content.ts, scripts/check-current-week.ts |

---

## Candidate for cleanup (not referenced in codebase)

| Collection | Count | Last activity |
|------------|-------|----------------|
| learning_annotations | 1 | 1/24/2026, 8:30:58 AM |
| learning_quiz_results | 1 | 1/25/2026, 6:57:53 AM |
| learning_quizzes | 2 | 1/25/2026, 5:36:57 PM |
| learning_summaries | 3 | 1/25/2026, 5:36:18 PM |
| student_notes | 1 | 1/23/2026, 2:54:04 PM |

Review these before dropping. They may be used by external tools or legacy code.

---

## Usage detail (known collections)

### `Coins`

- **Count:** 184
- **Last activity:** 1/13/2026, 12:52:19 PM
- **Referenced in:**
  - `lib/coins.ts`

### `CoinsStatus`

- **Count:** 1
- **Last activity:** 2/24/2026, 11:58:06 AM
- **Referenced in:**
  - `lib/coins.ts`

### `Feedbacks`

- **Count:** 49
- **Last activity:** 6/12/2025, 10:17:02 AM
- **Referenced in:**
  - `app/api/feedback.ts`
  - `scripts/analyze-student-data.ts`
  - `scripts/export-michael-usage.ts`

### `Status`

- **Count:** 1
- **Last activity:** 2/23/2025, 12:07:21 PM
- **Referenced in:**
  - `app/api/admin/status/route.ts`

### `UserForms`

- **Count:** 630
- **Last activity:** 1/21/2026, 9:53:36 AM
- **Referenced in:**
  - `app/api/feedback/user-form/route.ts`

### `analysis_results`

- **Count:** 185
- **Last activity:** 1/24/2026, 9:48:04 PM
- **Referenced in:**
  - `lib/ai-analysis-engine.ts`
  - `app/api/analysis/insights/route.ts`
  - `app/api/analysis/student`

### `analytics_events`

- **Count:** 0
- **Referenced in:**
  - `scripts/export-homework-1*.ts`
  - `scripts/export-michael-usage.ts`

### `audit_logs`

- **Count:** 0
- **Referenced in:**
  - `lib/models.ts`

### `chatMessages`

- **Count:** 102,785
- **Last activity:** 2/27/2026, 5:40:02 PM
- **Referenced in:**
  - `lib/chat.ts`
  - `lib/ai-analysis-engine.ts`
  - `scripts/analyze-student-data.ts`

### `chatSessions`

- **Count:** 1,910
- **Last activity:** 2/27/2026, 4:29:02 PM
- **Referenced in:**
  - `lib/chat.ts`
  - `scripts/analyze-student-data.ts`

### `conversation_summaries`

- **Count:** 349
- **Last activity:** 2/24/2026, 11:58:08 AM
- **Referenced in:**
  - `scripts/analyze-student-data.ts`

### `datasets`

- **Count:** 6
- **Last activity:** 1/29/2026, 3:27:11 PM
- **Referenced in:**
  - `lib/datasets.ts`
  - `lib/data-generation.ts`
  - `scripts/migrate-to-database.ts`
  - `app/api/datasets`

### `generated_data`

- **Count:** 1
- **Last activity:** 10/22/2025, 8:47:13 AM
- **Referenced in:**
  - `lib/data-generation.ts`
  - `app/api/datasets/[id]/preview-generated/route.ts`

### `homework_sets`

- **Count:** 2
- **Last activity:** 2/22/2026, 8:07:57 AM
- **Referenced in:**
  - `lib/homework.ts`
  - `scripts/export-homework-1*.ts`
  - `scripts/check-*.ts`
  - `lib/submissions.ts`

### `instantiated_questions`

- **Count:** 31
- **Last activity:** 10/26/2025, 4:29:44 PM
- **Referenced in:**
  - `lib/template-service.ts`
  - `scripts/export-homework-1*.ts`

### `ip_rate_limits`

- **Count:** 0
- **Referenced in:**
  - `scripts/cleanup-expired-tokens.ts`
  - `scripts/setup-database-security.ts`

### `notifications`

- **Count:** 0
- **Referenced in:**
  - `lib/notifications.ts`
  - `app/api/admin/notifications`

### `password_reset_tokens`

- **Count:** 32
- **Last activity:** 2/27/2026, 6:23:47 PM
- **Referenced in:**
  - `lib/users.ts`
  - `scripts/cleanup-expired-tokens.ts`
  - `app/api/test-database/route.ts`

### `practiceAttempts`

- **Count:** 38
- **Last activity:** 2/25/2026, 4:10:25 PM
- **Referenced in:**
  - `lib/practice.ts`

### `practiceQueries`

- **Count:** 66
- **Last activity:** 8/30/2025, 8:54:22 AM
- **Referenced in:**
  - `lib/practice.ts`

### `practiceTables`

- **Count:** 11
- **Last activity:** 8/31/2025, 8:49:59 AM
- **Referenced in:**
  - `lib/practice.ts`

### `question_analytics`

- **Count:** 1,145
- **Last activity:** 2/28/2026, 1:44:05 AM
- **Referenced in:**
  - `lib/question-analytics.ts`
  - `scripts/export-michael-usage.ts`

### `question_templates`

- **Count:** 26
- **Last activity:** 10/26/2025, 4:39:56 PM
- **Referenced in:**
  - `lib/template-service.ts`
  - `scripts/export-homework-1*.ts`

### `questions`

- **Count:** 146
- **Last activity:** 8/7/2025, 12:34:12 PM
- **Referenced in:**
  - `lib/questions.ts`
  - `lib/submissions.ts`
  - `scripts/export-homework-1*.ts`

### `rate_limits`

- **Count:** 0
- **Referenced in:**
  - `lib/rate-limiter.ts`
  - `scripts/cleanup-expired-tokens.ts`
  - `scripts/setup-database-security.ts`

### `security_events`

- **Count:** 0
- **Referenced in:**
  - `lib/monitoring.ts`
  - `scripts/cleanup-expired-tokens.ts`
  - `scripts/setup-database-security.ts`

### `semester_config`

- **Count:** 2
- **Last activity:** 2/3/2026, 2:37:21 PM
- **Referenced in:**
  - `lib/content.ts`
  - `lib/openai/runtime-config.ts`
  - `lib/openai/vector-store.ts`
  - `scripts/check-current-week.ts`

### `student_activities`

- **Count:** 30,664
- **Last activity:** 2/27/2026, 5:37:39 PM
- **Referenced in:**
  - `lib/activity-tracker.ts`
  - `lib/student-profiles.ts`
  - `app/api/admin/students/export`
  - `scripts/analyze-student-data.ts`

### `student_profiles`

- **Count:** 61
- **Last activity:** 1/25/2026, 12:23:10 PM
- **Referenced in:**
  - `lib/student-profiles.ts`
  - `lib/activity-tracker.ts`
  - `app/api/admin/students`
  - `scripts/analyze-student-data.ts`

### `submissions`

- **Count:** 92
- **Last activity:** 2/27/2026, 10:49:14 PM
- **Referenced in:**
  - `lib/submissions.ts`
  - `lib/homework.ts`
  - `lib/ai-analysis-engine.ts`
  - `scripts/check-*.ts`
  - `app/api/submissions`

### `submitted`

- **Count:** 57
- **Last activity:** 1/14/2026, 7:07:48 AM
- **Referenced in:**
  - `scripts/populate-submitted-collection.ts`
  - `scripts/view-submitted-collection.ts`
  - `scripts/resend-submission-email.ts`

### `userPoints`

- **Count:** 1
- **Last activity:** 9/17/2025, 3:21:26 PM
- **Referenced in:**
  - `app/api/user-points/route.ts`
  - `scripts/analyze-student-data.ts`

### `users`

- **Count:** 85
- **Last activity:** 1/11/2026, 11:45:28 PM
- **Referenced in:**
  - `lib/users.ts`
  - `lib/student-profiles.ts`
  - `app/api/admin/students`
  - `scripts/upload-users-to-mongo.ts`
  - `scripts/analyze-student-data.ts`

### `weekly_content`

- **Count:** 13
- **Last activity:** 1/1/2026, 4:27:04 PM
- **Referenced in:**
  - `lib/content.ts`
  - `scripts/check-current-week.ts`
