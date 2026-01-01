# MCP Mechanism Fix - Week Context Awareness Issue

## ✅ LATEST FIX (Current Session)
**Issue:** Assistant was providing ALTER TABLE examples in week 9, even though ALTER is taught in week 11.

**Fix Applied:**
1. Strengthened assistant instructions with explicit prohibition rules
2. Added Hebrew response templates for forbidden concepts
3. Enhanced function description to emphasize checking forbiddenConcepts
4. Added specific examples: "If asked about ALTER in week 9, say it's learned in week 11 and suggest CREATE TABLE instead"

**Status:** Instructions updated. Assistant needs to be updated via `/api/assistants/update` endpoint.

---

## Problem Description

**Current Issue:** In week 9, the chatbot incorrectly states that students haven't reached JOIN operations, even though JOIN is taught in week 7. The chatbot should be aware that in week 9, students have learned concepts from weeks 1-9 (cumulative), including JOIN.

**Expected Behavior:** 
- Week 9 should include all concepts from weeks 1-9
- JOIN (taught in week 7) should be available in week 9
- The assistant should call `get_course_week_context()` before answering SQL questions
- The assistant should respect `sqlRestrictions.allowedConcepts` and `sqlRestrictions.forbiddenConcepts`

**Actual Behavior:**
- The assistant is saying JOIN hasn't been reached in week 9
- This suggests either:
  1. The function `get_course_week_context()` is not being called
  2. The function is called but the week number is incorrect
  3. The function is called but the assistant is not respecting the restrictions properly
  4. The week calculation logic is wrong

---

## Root Cause Analysis

### 1. Function Call Reliability
**Location:** `app/api/assistants/update/route.ts`, `app/api/assistants/route.ts`

**Issue:** The assistant instructions say "MUST call get_course_week_context()" but there's no technical enforcement. The OpenAI Assistants API doesn't support "required" functions - it relies on the LLM to follow instructions.

**Current Instructions:**
```
CRITICAL: Before answering ANY SQL-related question, you MUST:
1. Call get_course_week_context() to determine the current academic week
2. Check the sqlRestrictions field in the response to see which concepts are allowed/forbidden
```

**Problem:** The assistant might skip this step, especially for:
- General SQL questions that don't explicitly mention "week" or "course"
- Questions where the assistant thinks it knows the answer
- Questions that seem unrelated to weekly context

### 2. Week Calculation Logic
**Location:** `lib/content.ts` - `getCurrentWeekContextNormalized()`

**Current Logic:**
```typescript
const now = new Date()
const startDate = new Date(startDateStr)
const diffMs = now.getTime() - startDate.getTime()
const rawWeek = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
const week = this.clampWeek(rawWeek)
```

**🚨 CRITICAL ISSUE FOUND:**
There's an **inconsistency** in week calculation methods:
- **Backend (`lib/content.ts`)**: Uses `Math.floor()` + 1
- **Frontend (`app/components/McpMichaelPage.tsx`)**: Uses `Math.ceil()`

This means the frontend and backend might calculate different week numbers for the same date!

**Potential Issues:**
- Uses `Math.floor()` which might cause off-by-one errors
- **INCONSISTENCY**: Frontend uses `Math.ceil()`, backend uses `Math.floor()` + 1
- Timezone issues if `startDate` and `now` are in different timezones
- Week calculation might be off if semester start date is incorrect

**Verification Needed:**
- Check if semester start date in database is correct
- Verify current week calculation matches actual calendar week
- Test edge cases (start of week, end of week, timezone boundaries)

### 3. SQL Curriculum Mapping
**Location:** `lib/sql-curriculum.ts`

**Current Implementation:**
- `getAllowedConceptsForWeek(week)` - Returns cumulative concepts from weeks 1 to `week`
- `getForbiddenConceptsForWeek(week)` - Returns concepts from weeks `week+1` to 13

**Verification:**
- Week 7 includes JOIN in `allowedConcepts`
- Week 9 should include JOIN (from week 7) in `allowedConcepts`
- Week 9 should NOT have JOIN in `forbiddenConcepts`

**Test Cases:**
```typescript
// Week 7
getAllowedConceptsForWeek(7) // Should include 'JOIN', 'ON', 'USING'
getForbiddenConceptsForWeek(7) // Should NOT include 'JOIN'

// Week 9
getAllowedConceptsForWeek(9) // Should include 'JOIN' (from week 7) + 'subquery' (from week 9)
getForbiddenConceptsForWeek(9) // Should NOT include 'JOIN' or 'subquery'
```

### 4. Function Response Format
**Location:** `app/api/assistants/functions/course-context/route.ts`

**Current Response:**
```json
{
  "weekNumber": 9,
  "content": "...",
  "dateRange": "...",
  "sqlRestrictions": {
    "allowedConcepts": ["JOIN", "ON", "USING", "subquery", ...],
    "forbiddenConcepts": [...],
    "weekNumber": 9
  }
}
```

**Issue:** The assistant might not be parsing or using the `sqlRestrictions` field correctly. The instructions mention it, but the assistant might:
- Ignore the restrictions
- Misinterpret the cumulative nature (week 9 = weeks 1-9)
- Not check the restrictions before providing SQL examples

### 5. Fallback Context Injection
**Location:** `app/api/assistants/threads/[threadId]/messages/route.ts`

**Current Implementation:**
```typescript
const weeklyResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/mcp-michael/current-week`);
if (weeklyResponse.ok) {
  const weeklyData = await weeklyResponse.json();
  const weekNum = weeklyData.weekNumber ?? weeklyData.currentWeek;
  if (weeklyData.content && weeklyData.content.trim()) {
    weeklyContext = `\n\n[Current Week Context - Week ${weekNum}: ${weeklyData.content}. IMPORTANT: Only use SQL concepts taught up to week ${weekNum}. Do NOT use JOINs before week 7, or sub-queries before week 9.]`;
  }
}
```

**Issues:**
- This is a fallback that adds context as a string to the user message
- It doesn't include the `sqlRestrictions` object
- The hardcoded message says "Do NOT use JOINs before week 7" but doesn't say "JOINs ARE allowed in week 9"
- This might conflict with or override the function call results

---

## Investigation Steps

### Step 1: Verify Week Calculation
1. Check the semester start date in the database
2. Calculate what week it should be today
3. Compare with what `getCurrentWeekContextNormalized()` returns
4. Test the calculation with different dates

**Commands:**
```bash
# Check current week calculation
# Run a test script or check logs
```

### Step 2: Test SQL Curriculum Functions
1. Test `getAllowedConceptsForWeek(9)` - should include JOIN
2. Test `getForbiddenConceptsForWeek(9)` - should NOT include JOIN
3. Verify the cumulative logic works correctly

**Test Script:**
```typescript
import { getAllowedConceptsForWeek, getForbiddenConceptsForWeek } from '@/lib/sql-curriculum'

console.log('Week 7 allowed:', getAllowedConceptsForWeek(7))
console.log('Week 7 forbidden:', getForbiddenConceptsForWeek(7))
console.log('Week 9 allowed:', getAllowedConceptsForWeek(9))
console.log('Week 9 forbidden:', getForbiddenConceptsForWeek(9))
```

### Step 3: Check Function Call Logs
1. Review server logs for `[course-context] request` entries
2. Check if the function is being called for SQL questions
3. Verify the responses being returned

**Log Locations:**
- `app/api/assistants/functions/course-context/route.ts` - line 14
- Check for errors in function execution

### Step 4: Test Assistant Behavior
1. Ask the assistant a SQL question that requires JOIN
2. Check if it calls `get_course_week_context()` first
3. Verify the response respects week 9 restrictions (JOIN should be allowed)

---

## Fix Strategy

### Fix 1: Strengthen Assistant Instructions
**File:** `app/api/assistants/update/route.ts`

**Changes:**
1. Make the instructions more explicit about cumulative weeks
2. Add examples showing week 9 includes weeks 1-9
3. Emphasize checking `sqlRestrictions.allowedConcepts` before ANY SQL example
4. Add explicit instruction: "If weekNumber is 9, you have access to ALL concepts from weeks 1-9, including JOIN (week 7) and sub-queries (week 9)"

**New Instructions Section:**
```
CRITICAL WEEK CONTEXT RULES:
- The curriculum is CUMULATIVE: Week N includes ALL concepts from weeks 1 through N
- Example: Week 9 means students have learned weeks 1, 2, 3, 4, 5, 6, 7, 8, and 9
- Week 9 includes JOIN (from week 7) AND sub-queries (from week 9)
- ALWAYS call get_course_week_context() FIRST before answering SQL questions
- ALWAYS check sqlRestrictions.allowedConcepts - if JOIN is in allowedConcepts, you CAN use it
- If a concept is in allowedConcepts, it means students have learned it
- If a concept is in forbiddenConcepts, students have NOT learned it yet
```

### Fix 2: Improve Function Description
**File:** `app/api/assistants/update/route.ts`

**Current:**
```typescript
description: "MANDATORY: Fetch the current academic week context. You MUST call this before answering any SQL question to ensure you only use concepts that have been taught. Returns week number, content, date range, and SQL concept restrictions (allowedConcepts and forbiddenConcepts)."
```

**Improved:**
```typescript
description: "MANDATORY: Fetch the current academic week context. You MUST call this function BEFORE answering ANY SQL-related question, even if it seems simple. The response includes sqlRestrictions.allowedConcepts (concepts students have learned) and sqlRestrictions.forbiddenConcepts (concepts not yet taught). The curriculum is cumulative: week 9 includes all concepts from weeks 1-9. Returns: { weekNumber, content, dateRange, sqlRestrictions: { allowedConcepts: string[], forbiddenConcepts: string[], weekNumber } }"
```

### Fix 3: Fix Week Calculation Inconsistency
**Files:** `lib/content.ts`, `app/components/McpMichaelPage.tsx`

**🚨 CRITICAL FIX NEEDED:**
The week calculation is inconsistent between frontend and backend. This must be fixed.

**Current State:**
- Backend (`lib/content.ts`): `Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1`
- Frontend (`McpMichaelPage.tsx`): `Math.ceil((now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))`

**Decision Needed:**
1. Choose one method (floor+1 or ceil) and use it consistently
2. Consider: Week 1 should start on day 1 of semester
3. Test with actual dates to verify correctness

**Recommended Fix:**
- Standardize on `Math.ceil()` approach (simpler, week starts on day 1)
- Update both files to use the same calculation
- Add timezone handling if needed
- Add unit tests for week calculation

### Fix 4: Enhance Fallback Context
**File:** `app/api/assistants/threads/[threadId]/messages/route.ts`

**Current Issue:** The fallback doesn't include `sqlRestrictions` and has hardcoded rules.

**Fix Options:**
1. Remove the fallback and rely solely on function calls (preferred)
2. Enhance the fallback to include `sqlRestrictions` from the API response
3. Make the fallback message dynamic based on actual week

**Recommended:** Option 1 - Remove or minimize the fallback, as it might confuse the assistant. The function call is the proper mechanism.

### Fix 5: Add Logging and Monitoring
**Files:** Multiple

**Add:**
1. Log when `get_course_week_context` is called
2. Log the week number and restrictions returned
3. Log if assistant uses forbidden concepts (post-processing check)
4. Add metrics to track function call frequency

### Fix 6: Add Validation/Enforcement (if possible)
**Consider:**
- Post-processing check: After assistant responds, validate SQL examples against `sqlRestrictions`
- Pre-processing: Inject week context more forcefully in system message (if OpenAI supports)
- Client-side: Check function calls and warn if not called for SQL questions

---

## Testing Plan

### Test 1: Week Calculation
```bash
# Test current week calculation
# Should return week 9 if we're in week 9
```

### Test 2: SQL Curriculum Functions
```typescript
// Test getAllowedConceptsForWeek(9)
expect(getAllowedConceptsForWeek(9)).toContain('JOIN')
expect(getAllowedConceptsForWeek(9)).toContain('subquery')
expect(getForbiddenConceptsForWeek(9)).not.toContain('JOIN')
expect(getForbiddenConceptsForWeek(9)).not.toContain('subquery')
```

### Test 3: Function Call
1. Ask assistant: "How do I join two tables?"
2. Verify function `get_course_week_context()` is called
3. Verify response includes JOIN examples (if week >= 7)
4. Verify response does NOT say "we haven't reached JOIN yet"

### Test 4: End-to-End
1. Set current week to 9 in database/test
2. Ask assistant SQL question requiring JOIN
3. Verify assistant:
   - Calls `get_course_week_context()`
   - Receives week 9 with JOIN in `allowedConcepts`
   - Provides JOIN examples without saying it's not taught yet

---

## Files to Modify

1. **`app/api/assistants/update/route.ts`**
   - Improve assistant instructions
   - Enhance function description
   - Add explicit cumulative week explanation

2. **`lib/content.ts`** (if week calculation is wrong)
   - Fix week calculation logic
   - Add timezone handling

3. **`app/api/assistants/threads/[threadId]/messages/route.ts`**
   - Remove or improve fallback context injection
   - Consider removing hardcoded restrictions

4. **`lib/sql-curriculum.ts`** (if curriculum mapping is wrong)
   - Verify and fix concept mappings
   - Add tests

5. **`app/api/assistants/functions/course-context/route.ts`**
   - Add better logging
   - Verify response format

---

## Success Criteria

1. ✅ Week 9 correctly includes JOIN in `allowedConcepts`
2. ✅ Assistant calls `get_course_week_context()` for SQL questions
3. ✅ Assistant respects `sqlRestrictions.allowedConcepts`
4. ✅ Assistant does NOT say "we haven't reached JOIN" in week 9
5. ✅ Week calculation is accurate
6. ✅ All tests pass

---

## Additional Notes

- The MCP (Model Context Protocol) mechanism here refers to the function calling system that provides context to the assistant
- The issue is that the assistant is not reliably using this context
- Consider adding a test suite specifically for week-based SQL restrictions
- Monitor function call frequency to ensure it's being used
- Consider adding a dashboard to view function call statistics

---

## Next Steps for Agent

1. **Investigate:**
   - Check current week calculation
   - Test SQL curriculum functions
   - Review logs for function calls
   - Test assistant behavior manually

2. **Fix:**
   - Update assistant instructions
   - Fix any calculation/logic errors found
   - Improve function descriptions
   - Remove/improve fallback context

3. **Test:**
   - Run all test cases
   - Manual testing with real questions
   - Verify week 9 includes JOIN

4. **Verify:**
   - Confirm assistant uses JOIN in week 9
   - Confirm function is called consistently
   - Check logs for proper behavior
