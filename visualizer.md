# Query Visualizer Plan

## Overview
Create an educational "Query Visualizer" for the AI assistant chat that animates SQL execution (with an emphasis on joins and other relational operations). The visualizer should support **all SQL keywords** by providing understandable, small-scale mock visualizations (even when backed by small mock tables). The experience should be interactive, student-friendly, and extensible.

## Goals
- Visualize SQL execution step-by-step with animations and clear explanations.
- Support all SQL keywords with at least a minimal visual representation.
- Provide mock data for demonstration when real tables are large or unavailable.
- Keep the UI modular so new visualizations can be added per keyword.
- Ensure accessibility (keyboard navigation, ARIA labels) and performance.

## Non-Goals (for initial version)
- Full-blown database engine simulation for large datasets.
- Perfectly faithful execution plan equivalence to every SQL dialect.
- Production-grade query planner and optimizer.

---

## Sprint 1: Foundations & Architecture
**Objective:** Establish architecture, UX baseline, and core scaffolding.

**Tasks**
1. **Research & UX definition** ✅
   - Documented visual patterns for tables, rows, joins, filters, aggregations, and projections.
   - Defined visual language (colors, icons, animations).
   - Drafted sample UX flow for simple SELECT + JOIN queries.
2. **Architecture plan** ✅
   - Defined component structure (VisualizerRoot, StepTimeline, TableView, JoinAnimator).
   - Designed data model for query steps (execution steps + animation timeline).
   - Chose static mock data for Sprint 1 demos.
3. **Scaffold** ✅
   - Added a `visualizer` module folder with placeholder components.
   - Defined TypeScript interfaces for `QueryStep`, `VisualizationNode`, and `AnimationStep`.
   - Added a minimal UI shell that renders a static mocked step sequence.

**Deliverables**
- UX spec and component plan.
- Interfaces and base components wired into the app (hidden behind a feature flag).

### Sprint 1 UX Spec (Draft)
**Visual patterns**
- **Tables**: Card with title, column headers, and scrollable rows. Use highlight pulse for focus steps.
- **Rows**: Alternating row lines with emphasized matches during joins (paired row chips).
- **Joins**: Side-by-side matching row badges with arrows; unmatched rows appear muted.
- **Filters**: Faded rows with emphasis ring on retained rows.
- **Aggregations**: Grouped row clusters with a summary “total” row badge.
- **Projections**: Column highlight with non-selected columns muted.

**Visual language**
- Primary accent: Indigo for active steps and matching rows.
- Neutral backgrounds for tables; cards on light slate background.
- Animation cues: highlight (pulse), move (join pairing), fade (filters), pulse (results).

**Sample UX flow**
1. Show source tables side-by-side.
2. Animate INNER JOIN pairing to form a join output node.
3. Highlight projection to display final columns.

**Implementation Notes**
- Added a `/visualizer` route guarded by `NEXT_PUBLIC_QUERY_VISUALIZER=1`, returning 404 when disabled.
- Implemented modular components (VisualizerRoot, StepTimeline, TableView, JoinAnimator) and core data types.
- Included a mocked step sequence that demonstrates table loading, INNER JOIN pairing, and projection output.
- Established an accessible UI shell with keyboard focus styles and ARIA labels for regions.

---

## Sprint 2: Parser + Step Generator (MVP)
**Objective:** Convert SQL into structured steps for visualization.

**Tasks**
1. **SQL parsing** ✅
   - Integrated an alasql parser adapter for AST extraction.
   - Normalized AST nodes into visualization-friendly structures.
2. **Step generator** ✅
   - Added a `Parse -> Normalize -> Step Sequence` pipeline.
   - Implemented minimal support for:
     - SELECT, FROM, WHERE
     - INNER JOIN
     - ORDER BY, LIMIT
3. **Mock data & schemas** ✅
   - Built a mock schema registry (tables, columns, sample rows).
   - Added deterministic mock datasets for demos.

**Deliverables**
- SQL parser adapter + step generator producing a step list.
- Mock data utilities.

**Implementation Notes**
- Added a SQL input panel and wired it to the step generator so edits immediately update the timeline.
- Built a normalization layer that extracts SELECT/FROM/JOIN/WHERE/ORDER/LIMIT details from the parser output.
- Created a mock schema registry (Students, Enrollments, Courses) and used it to render table and join steps.
- Updated join animations to display dynamically generated row pairings derived from the join condition.

---

## Sprint 3: Visual Rendering of Core Operations
**Objective:** Render and animate core SQL operations.

**Tasks**
1. **Table visualization** ✅
   - Render tables with rows, columns, and highlight filters.
2. **Join animations (core demo)** ✅
   - Visualize INNER JOIN as matching row pairs.
   - Animate row pairing and resulting output table.
3. **Filters and projections** ✅
   - Animate WHERE filtering and SELECT column projection.

**Deliverables**
- Working visualizer for basic SELECT + JOIN queries.
- Reusable animation helpers.

**Implementation Notes**
- Added row state styling for kept/filtered/matched rows and column highlighting for projections.
- Updated join rendering to include paired rows plus a live join output table.
- Enhanced the projection step to show pre-projection data alongside the final result.

---

## Sprint 4: Expanded Keyword Support
**Objective:** Cover additional SQL keywords with minimal viable visuals.

**Tasks**
1. **Join variants** ✅
   - LEFT, RIGHT, FULL, CROSS joins.
2. **Grouping & aggregation** ✅
   - GROUP BY, HAVING, aggregate functions.
3. **Set operations** ✅
   - UNION, INTERSECT, EXCEPT.
4. **Subqueries & CTEs** ✅
   - WITH (CTE) and nested SELECT.
5. **Data modification** ✅
   - INSERT, UPDATE, DELETE (show row changes).

**Deliverables**
- Visualizer supports a wide range of SQL keywords with simplified visuals.

**Implementation Notes**
- Expanded normalization to recognize join modes, group/having expressions, set operations, subqueries, and CTE-backed sources.
- Added lightweight aggregation and set-operation pipelines so grouping, HAVING filters, and UNION/INTERSECT/EXCEPT can render compact result tables.
- Implemented JOIN variants (LEFT/RIGHT/FULL/CROSS) with row-state cues for unmatched rows and updated join pairing summaries.
- Added mutation previews for INSERT, UPDATE, and DELETE to highlight inserted/updated/deleted rows alongside before/after snapshots.

---

## Sprint 5: Education & UX Enhancements
**Objective:** Make the visualizer engaging and classroom-ready.

**Tasks**
1. **Narration & captions**
   - Step-by-step explanations.
   - Glossary hints for keywords.
2. **Interactive controls**
   - Play, pause, step, scrub timeline.
   - Speed control.
3. **Learning mode**
   - Interactive quizzes or prompts (optional).

**Deliverables**
- Polished experience with narration and controls.

---

## Sprint 6: Full Coverage + Quality
**Objective:** Validate completeness and robustness.

**Tasks**
1. **Keyword coverage audit**
   - Map SQL keywords to visualizations.
   - Identify gaps and implement placeholders.
2. **Testing**
   - Unit tests for step generator and parser mapping.
   - UI tests for major keywords.
3. **Performance & accessibility**
   - Optimize for large step sequences.
   - Ensure ARIA and keyboard support.

**Deliverables**
- Keyword coverage checklist and test suite.
- Final QA pass.

---

## Sprint 14: Interactive Playback & Step Navigation
**Objective:** Add classroom-friendly playback controls, keyboard navigation, and clearer step context for the Query Visualizer.

**Tasks**
1. **Playback controls (Play/Pause/Next/Previous)** ✅
   - Added a control bar for stepping through query execution with clear button states.
   - Included step count and keyboard shortcut hints.
2. **Keyboard navigation** ✅
   - Implemented arrow key navigation for previous/next step.
   - Spacebar toggles play/pause while ignoring inputs when the SQL editor is focused.
3. **Timeline context improvements** ✅
   - Added a header and helper copy in the step timeline to guide learners.

**Deliverables**
- Interactive playback controls with accessible states.
- Keyboard-driven step navigation.
- Timeline header text to set context.

**Implementation Notes**
- Playback uses a lightweight interval to advance steps and stops automatically at the end.
- Controls reset to the first step when the SQL query changes.
- Buttons and hint text are styled to match the existing visualizer design.

## Future Enhancements (Post MVP)
- Query plan view (costs, indexes, join algorithms).
- Dialect switching (Postgres, MySQL, SQLite, etc.).
- Real data sampling from connected database.
- Export visualizations as GIF/video for teaching materials.

---

## Acceptance Criteria (MVP)
- Visualizer can parse simple SELECT + JOIN queries and animate execution steps.
- Students can clearly see how joins match rows and form results.
- Framework exists to support additional SQL keywords via plugin-like visuals.
- Documentation covers how to add new keyword visualizations.
