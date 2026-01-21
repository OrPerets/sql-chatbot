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
1. **Research & UX definition**
   - Document visual patterns for tables, rows, joins, filters, aggregations, and projections.
   - Define visual language (colors, icons, animations).
   - Draft sample UX flows for simple SELECT and JOIN queries.
2. **Architecture plan**
   - Define component structure (e.g., VisualizerRoot, StepTimeline, TableView, JoinAnimator).
   - Design data model for query steps (AST + execution steps + animation timeline).
   - Decide on mock data generation strategy.
3. **Scaffold**
   - Add a `visualizer` module folder with placeholder components.
   - Define TypeScript interfaces for `QueryStep`, `VisualizationNode`, and `AnimationStep`.
   - Add a minimal UI shell that can render a static mocked step sequence.

**Deliverables**
- UX spec and component plan.
- Interfaces and base components wired into the app (hidden behind a feature flag).

---

## Sprint 2: Parser + Step Generator (MVP)
**Objective:** Convert SQL into structured steps for visualization.

**Tasks**
1. **SQL parsing**
   - Integrate or wrap existing SQL parser library.
   - Map AST nodes to visualization step types.
2. **Step generator**
   - Create a pipeline that generates steps: `Parse -> Normalize -> Step Sequence`.
   - Implement minimal support for:
     - SELECT, FROM, WHERE
     - INNER JOIN
     - ORDER BY, LIMIT
3. **Mock data & schemas**
   - Build mock schema registry (tables, columns, sample rows).
   - Provide deterministic mock dataset for tests and demos.

**Deliverables**
- SQL parser adapter + step generator producing a step list.
- Mock data utilities.

---

## Sprint 3: Visual Rendering of Core Operations
**Objective:** Render and animate core SQL operations.

**Tasks**
1. **Table visualization**
   - Render tables with rows, columns, and highlight filters.
2. **Join animations (core demo)**
   - Visualize INNER JOIN as matching row pairs.
   - Animate row pairing and resulting output table.
3. **Filters and projections**
   - Animate WHERE filtering and SELECT column projection.

**Deliverables**
- Working visualizer for basic SELECT + JOIN queries.
- Reusable animation helpers.

---

## Sprint 4: Expanded Keyword Support
**Objective:** Cover additional SQL keywords with minimal viable visuals.

**Tasks**
1. **Join variants**
   - LEFT, RIGHT, FULL, CROSS joins.
2. **Grouping & aggregation**
   - GROUP BY, HAVING, aggregate functions.
3. **Set operations**
   - UNION, INTERSECT, EXCEPT.
4. **Subqueries & CTEs**
   - WITH (CTE) and nested SELECT.
5. **Data modification**
   - INSERT, UPDATE, DELETE (show row changes).

**Deliverables**
- Visualizer supports a wide range of SQL keywords with simplified visuals.

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
