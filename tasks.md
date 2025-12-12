# Fix: AI Assistant Using Advanced SQL Concepts Before They're Taught

## Problem Summary
The MCP Michael AI assistant is responding to student questions with SQL concepts (JOINs, sub-queries) that haven't been studied yet according to the semester calendar. For example, if students are in week 3, the assistant shouldn't use JOINs (taught in week 7) or sub-queries (taught in week 9).

## Root Cause Analysis

### Current Implementation Issues

1. **Assistant Instructions Don't Restrict SQL Concepts**
   - Location: `app/api/assistants/update/route.ts` and `app/api/assistants/route.ts`
   - Problem: Instructions only tell the assistant to call `get_course_week_context` for questions about "what we learn this week", NOT for general SQL questions
   - The assistant has no guidance to restrict SQL concepts based on curriculum week

2. **Weekly Context Not Automatically Used**
   - Location: `app/api/assistants/threads/[threadId]/messages/route.ts`
   - Current: Weekly context is only injected if `MCP_FORCE_PROMPT_CONTEXT=1` environment variable is set
   - Problem: Even when injected, the assistant instructions don't tell it to USE this context to restrict SQL concepts

3. **No SQL Concept-to-Week Mapping**
   - There's no explicit mapping of SQL concepts to curriculum weeks
   - The assistant can't know which concepts are allowed for which week

### Curriculum Week Mapping (from `docs/semester-calendar-setup.md`)

| Week | Topics | SQL Concepts Allowed |
|------|--------|---------------------|
| 1 | הגדרות בסיסיות / DDL / יצירת טבלאות | CREATE TABLE, DDL basics |
| 2 | אילוצים / SELECT / MYSQL | SELECT, constraints |
| 3 | FROM / WHERE / BETWEEN / LIKE | FROM, WHERE, BETWEEN, LIKE |
| 4 | צירוף יחסיים / GROUP BY | GROUP BY (basic) |
| 5 | משתנים ופונקציות ב-SQL | SQL functions, variables |
| 6 | COUNT / DISTINCT / GROUP BY | COUNT, DISTINCT, GROUP BY (advanced) |
| 7 | JOIN / ON / USING | **JOIN, ON, USING** |
| 8 | NULL / DML: INSERT, UPDATE, DELETE | NULL, INSERT, UPDATE, DELETE |
| 9 | תתי שאילות / תרגול Holmes Place | **Sub-queries** |
| 10 | מפתח ראשי / מפתח זר / DDL | Primary keys, Foreign keys |
| 11 | ALTER / אינדקס / תרגול | ALTER, indexes |
| 12 | DROP / VIEWS / טבלאות זמניות | DROP, VIEWS, temporary tables |
| 13 | טריגרים / טבלאות וירטואליות | Triggers, virtual tables |

## Solution Steps

### Step 1: Create SQL Concept Restriction Mapping

**File:** `lib/sql-curriculum.ts` (NEW FILE)

Create a utility that maps SQL concepts to the week they're introduced:

```typescript
export const SQL_CURRICULUM_MAP: Record<number, {
  week: number;
  concepts: string[];
  forbiddenConcepts: string[];
}> = {
  1: {
    week: 1,
    concepts: ['CREATE TABLE', 'DDL', 'CREATE', 'TABLE'],
    forbiddenConcepts: ['SELECT', 'JOIN', 'WHERE', 'GROUP BY', 'subquery', 'sub-query']
  },
  2: {
    week: 2,
    concepts: ['SELECT', 'constraints', 'CONSTRAINT'],
    forbiddenConcepts: ['JOIN', 'GROUP BY', 'subquery', 'sub-query', 'WHERE', 'BETWEEN', 'LIKE']
  },
  3: {
    week: 3,
    concepts: ['FROM', 'WHERE', 'BETWEEN', 'LIKE'],
    forbiddenConcepts: ['JOIN', 'GROUP BY', 'COUNT', 'DISTINCT', 'subquery', 'sub-query']
  },
  4: {
    week: 4,
    concepts: ['GROUP BY', 'aggregation'],
    forbiddenConcepts: ['JOIN', 'COUNT', 'DISTINCT', 'subquery', 'sub-query']
  },
  5: {
    week: 5,
    concepts: ['functions', 'variables', 'SQL functions'],
    forbiddenConcepts: ['JOIN', 'subquery', 'sub-query']
  },
  6: {
    week: 6,
    concepts: ['COUNT', 'DISTINCT', 'GROUP BY advanced'],
    forbiddenConcepts: ['JOIN', 'subquery', 'sub-query']
  },
  7: {
    week: 7,
    concepts: ['JOIN', 'ON', 'USING', 'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN'],
    forbiddenConcepts: ['subquery', 'sub-query']
  },
  8: {
    week: 8,
    concepts: ['NULL', 'INSERT', 'UPDATE', 'DELETE', 'DML'],
    forbiddenConcepts: ['subquery', 'sub-query']
  },
  9: {
    week: 9,
    concepts: ['subquery', 'sub-query', 'nested query'],
    forbiddenConcepts: []
  },
  // ... continue for weeks 10-13
};

export function getAllowedConceptsForWeek(week: number): string[] {
  const allowed: string[] = [];
  for (let w = 1; w <= week; w++) {
    if (SQL_CURRICULUM_MAP[w]) {
      allowed.push(...SQL_CURRICULUM_MAP[w].concepts);
    }
  }
  return allowed;
}

export function getForbiddenConceptsForWeek(week: number): string[] {
  const forbidden: string[] = [];
  for (let w = 1; w <= week; w++) {
    if (SQL_CURRICULUM_MAP[w]) {
      forbidden.push(...SQL_CURRICULUM_MAP[w].forbiddenConcepts);
    }
  }
  // Remove duplicates and concepts that are now allowed
  const allowed = getAllowedConceptsForWeek(week);
  return [...new Set(forbidden)].filter(c => !allowed.includes(c));
}
```

### Step 2: Update Assistant Instructions

**File:** `app/api/assistants/update/route.ts`

**Changes needed:**

1. **Add instruction to ALWAYS check week context before answering SQL questions:**
   ```typescript
   instructions: `You are Michael, a helpful SQL teaching assistant for academic courses. 
   
   CRITICAL: Before answering ANY SQL-related question, you MUST:
   1. Call get_course_week_context() to determine the current academic week
   2. Restrict your SQL examples and explanations to ONLY concepts taught up to that week
   3. If a student asks about concepts not yet taught, politely explain that those topics will be covered in future weeks
   
   Week-based SQL concept restrictions:
   - Weeks 1-2: Only DDL (CREATE TABLE) and basic SELECT
   - Weeks 3-4: Add WHERE, FROM, BETWEEN, LIKE, basic GROUP BY
   - Weeks 5-6: Add SQL functions, COUNT, DISTINCT, advanced GROUP BY
   - Week 7+: JOIN operations allowed
   - Week 9+: Sub-queries allowed
   
   NEVER use JOINs before week 7, and NEVER use sub-queries before week 9.
   If a student's question requires concepts not yet taught, suggest alternative approaches using only concepts from their current week or earlier.
   
   [Rest of existing instructions...]
   `
   ```

2. **Enhance the function description:**
   ```typescript
   {
     type: "function",
     function: {
       name: "get_course_week_context",
       description: "MANDATORY: Fetch the current academic week context. You MUST call this before answering any SQL question to ensure you only use concepts that have been taught. Returns week number, content, and date range.",
       parameters: {
         // ... existing parameters
       }
     }
   }
   ```

### Step 3: Enhance Course Context Function Response

**File:** `app/api/assistants/functions/course-context/route.ts`

**Changes needed:**

1. Import the SQL curriculum mapping:
   ```typescript
   import { getAllowedConceptsForWeek, getForbiddenConceptsForWeek } from '@/lib/sql-curriculum'
   ```

2. Enhance the response to include SQL concept restrictions:
   ```typescript
   async function handleGetCourseWeekContext(params: GetCourseWeekContextParams) {
     const week = typeof params?.week === 'number' ? params.week : undefined

     try {
       const payload = week
         ? await getWeekContextByNumberNormalized(week)
         : await getCurrentWeekContextNormalized(null)

       const weekNumber = payload.weekNumber
       const allowedConcepts = weekNumber ? getAllowedConceptsForWeek(weekNumber) : []
       const forbiddenConcepts = weekNumber ? getForbiddenConceptsForWeek(weekNumber) : []

       const out = JSON.stringify({
         weekNumber: payload.weekNumber,
         content: payload.content,
         dateRange: payload.dateRange,
         updatedAt: payload.updatedAt || null,
         updatedBy: payload.updatedBy || null,
         sqlRestrictions: {
           allowedConcepts: allowedConcepts,
           forbiddenConcepts: forbiddenConcepts,
           weekNumber: weekNumber
         },
         fetchedAt: new Date().toISOString(),
       })
       return new Response(out, { headers: { 'Content-Type': 'text/plain' } })
     } catch (error: any) {
       // ... error handling
     }
   }
   ```

### Step 4: Update Assistant Instructions to Use SQL Restrictions

**File:** `app/api/assistants/update/route.ts`

**Add to instructions:**
```typescript
When get_course_week_context returns sqlRestrictions:
- ONLY use SQL concepts listed in allowedConcepts
- NEVER use concepts listed in forbiddenConcepts
- If a student asks about a forbidden concept, explain: "This concept (e.g., JOINs) will be covered in week X. For now, let's solve this using [allowed concepts]."
- Always check the weekNumber from the context before providing SQL examples
```

### Step 5: Make Weekly Context Injection Mandatory

**File:** `app/api/assistants/threads/[threadId]/messages/route.ts`

**Changes needed:**

1. Remove the `MCP_FORCE_PROMPT_CONTEXT` conditional - make it always fetch:
   ```typescript
   // Always fetch weekly context (remove the if condition)
   let weeklyContext = '';
   try {
     const weeklyResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mcp-michael/current-week`);
     if (weeklyResponse.ok) {
       const weeklyData = await weeklyResponse.json();
       const weekNum = weeklyData.weekNumber;
       if (weeklyData.content && weeklyData.content.trim()) {
         weeklyContext = `\n\n[Current Week Context - Week ${weekNum}: ${weeklyData.content}. IMPORTANT: Only use SQL concepts taught up to week ${weekNum}. Do NOT use JOINs before week 7, or sub-queries before week 9.]`;
       }
     }
   } catch (weeklyError) {
     console.log('Could not fetch weekly context:', weeklyError);
     // Continue without weekly context if fetch fails
   }
   ```

### Step 6: Add Validation in SQL Execution Function

**File:** `app/api/assistants/functions/sql/route.ts`

**Optional enhancement:** Add validation to reject queries with forbidden concepts based on current week. However, this might be too restrictive - better to let the assistant handle it through instructions.

### Step 7: Testing Checklist

1. **Test Week 1-2 (No JOINs, no sub-queries):**
   - Ask: "How do I combine data from two tables?"
   - Expected: Assistant should NOT suggest JOINs, should explain it will be covered in week 7

2. **Test Week 3-6 (No JOINs, no sub-queries):**
   - Ask: "How do I find employees in a specific department?"
   - Expected: Assistant should use WHERE clauses, not JOINs

3. **Test Week 7+ (JOINs allowed):**
   - Ask: "How do I combine data from two tables?"
   - Expected: Assistant should suggest JOINs

4. **Test Week 1-8 (No sub-queries):**
   - Ask: "How do I find the maximum salary in each department?"
   - Expected: Assistant should NOT use sub-queries, should use GROUP BY or explain it will be covered in week 9

5. **Test Week 9+ (Sub-queries allowed):**
   - Ask: "How do I find employees with above-average salary?"
   - Expected: Assistant should suggest sub-queries

### Step 8: Update Documentation

**File:** `docs/semester-calendar-setup.md`

Add a section explaining:
- How SQL concept restrictions work
- The curriculum mapping
- How the assistant enforces week-based restrictions

## Implementation Priority

1. **HIGH:** Step 1 (Create SQL curriculum mapping) - Foundation for everything
2. **HIGH:** Step 2 (Update assistant instructions) - Core fix
3. **HIGH:** Step 3 (Enhance course context response) - Provides restriction data
4. **MEDIUM:** Step 4 (Update instructions to use restrictions) - Makes restrictions explicit
5. **MEDIUM:** Step 5 (Make context injection mandatory) - Ensures context is always available
6. **LOW:** Step 6 (SQL execution validation) - Optional safety net
7. **MEDIUM:** Step 7 (Testing) - Verify the fix works
8. **LOW:** Step 8 (Documentation) - For future reference

## Environment Variables

Check if `MCP_FORCE_PROMPT_CONTEXT` is set in production. If not, Step 5 will make it always active.

## Rollout Plan

1. Create the SQL curriculum mapping file
2. Test locally with different week contexts
3. Update assistant instructions via `/api/assistants/update` endpoint
4. Monitor assistant responses to ensure restrictions are working
5. Adjust curriculum mapping if needed based on actual curriculum

## Notes

- The assistant might still occasionally use advanced concepts if not explicitly restricted. Consider adding a post-processing step to detect and flag responses with forbidden concepts.
- The curriculum mapping should be maintained as the course evolves.
- Consider adding admin UI to view/edit the SQL curriculum mapping alongside weekly content.
