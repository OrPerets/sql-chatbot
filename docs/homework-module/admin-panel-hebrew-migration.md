# Admin Panel Homework Integration & Hebrew Localization

This checklist walks through extending the rebuilt Full Homework Exercise module so it can be managed from the `/admin` experience, reusing the existing styling from the student/builder app, and localising the UI for Hebrew-speaking instructors and learners.

## 1. Expose Homework Management Inside `/admin`

### 1.1 Routing & Access Control
- Map `/admin/homework` to the builder dashboard (`app/homework/builder`).
  - Add a Next.js route alias under `app/admin/homework/page.tsx` that re-exports the builder dashboard client component.
  - Wrap the page with the same `requireRole('instructor')` guard to ensure only instructors/admins enter from `/admin`.
- Update `/admin` navigation to include “ניהול שיעורי בית” linking to the new route.

### 1.2 Shared Layout Composition
- Rehydrate the builder shell inside the admin panel by:
  - Importing `BuilderShell` layout into the new page where possible.
  - If `/admin` uses its own shell, mount the builder UI within an `<AdminLayout>` slot to maintain breadcrumbs/top bar.
- Ensure React Query provider from `HomeworkQueryProvider` stays at module scope (wrap in the admin route as needed).

### 1.3 API Bridging
- Confirm `/admin` API calls point to the same endpoints introduced in Sprints 2–4 (`/api/homework`, `/api/submissions`, `/api/sql/execute`).
- If the admin panel proxies through an Express backend, add matching routes there (e.g., `/admin/api/homework`) that forward requests to the Next.js handlers or backend Node service.
- Propagate auth/session cookies between `/admin` and `/homework` requests to keep permissions aligned.

## 2. Adopt Homework Styling Within `/admin`

### 2.1 Shared Styles & Design Tokens
- Extract reusable CSS variables from `app/homework/module.module.css` and `runner.module.css` into a shared stylesheet (e.g., `app/homework/common/theme.css`).
- Import these tokens inside the admin stylesheet so color palettes, typography, and spacing match the student/builder module.

### 2.2 Component Reuse Strategy
- Replace legacy admin tables/forms with the components already built in Sprints 2–4:
  - Dashboard cards → reuse `BuilderDashboard` grid.
  - Wizard steps → reuse `HomeworkWizard` and step components.
  - Grading workspace → mount `GradeHomeworkClient` inside admin layout.
- Remove redundant admin CSS (`app/admin/exam-grading`, `grade-by-question`, etc.) after confirmation that the new homework module covers all flows.

### 2.3 Responsive & RTL Considerations
- Validate responsive breakpoints in the admin shell—builder styles assume grid widths of 320 px/280 px sidebars.
- Ensure buttons/headers inherit the same shadow and border radii by importing the shared module CSS.

## 3. Hebrew Localisation (תמיכה בעברית)

### 3.1 Internationalisation Framework
- Enable i18n support in Next.js (`next.config.mjs`) with `defaultLocale: 'he'` (Hebrew) and fallback English if required.
- Introduce translation dictionaries for homework strings (e.g., `app/homework/locales/he.json`).
- Wrap UI with a translation hook (`useTranslations`) or a lightweight context if not using a library like `next-intl`.

### 3.2 Translate UI Copy
- Translate builder and runner strings:
  - Buttons: “Run query” → “הרץ שאילתה”, “Submit homework” → “הגש שיעור בית”.
  - Labels: “Questions”, “Feedback”, “Autosave”, etc.
  - Admin navigation: “New Homework Set” → “יצירת שיעור בית חדש”.
- Convert instructional copy (overviews, placeholders) to right-to-left text.

### 3.3 RTL Styling Updates
- Apply `dir="rtl"` on the root layout when locale is Hebrew.
- Mirror flex/grid directions:
  - Replace `gap` and `margin-left/right` with logical properties (`margin-inline-start`/`end`).
  - Update navigation buttons to align icons and text for RTL.
- Verify Monaco Editor supports RTL text; if needed, enable `direction: 'rtl'` via its options and set `fontFamily` to include Hebrew-friendly fonts.

### 3.4 Date & Number Localisation
- Format dates using `Intl.DateTimeFormat('he-IL', ...)` so due dates render in Hebrew.
- Convert scores/attempt counters to leverage `Intl.NumberFormat('he-IL')`.

### 3.5 QA Checklist
- Run the builder, runner, and grading flows in Hebrew to validate text overflow, RTL alignment, and button spacing.
- Confirm accessibility announcements (screen readers) read the Hebrew copy correctly.
- Update Playwright scenarios to toggle locale and screenshot key pages for visual regression.

## Release Checklist
- [ ] Admin route redirects to the homework dashboard without broken links.
- [ ] All homework pages retain consistent styling inside `/admin`.
- [ ] Hebrew strings verified across runner/builder/grading.
- [ ] Unit + e2e tests pass (including new RTL snapshots).
- [ ] Documentation updated (link this guide from `docs/homework-module/runner-grading-guide.md`).
