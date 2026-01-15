# Homework 3 Development Tasks

## Overview
This document contains detailed task instructions for Homework 3 student interface and grading interface improvements, organized into logical sprints with todo lists for each sprint.

---

## Sprint 1: Student Interface - Core UI Improvements

### Goal
Improve basic UI elements and functionality in the student homework runner interface.

### Todo List

#### Task 1.1: Add PDF Download Option for Database Schema
**Location**: `app/homework/runner/[setId]/RunnerClient.tsx`

**Description**: 
Add a button in the right sidebar menu to download a PDF containing:
- All database tables (Students, Courses, Lecturers, Enrollments)
- Table structures (columns, data types, constraints)
- Sample data or at minimum the schema definition

**Implementation Steps**:
1. Add a new button in the sidebar (near the database viewer button) labeled "הורד PDF של מסד הנתונים"
2. Create a new API endpoint `/api/homework/[setId]/database-pdf` that:
   - Fetches the student's assigned table data from `submission.studentTableData`
   - If no student data exists, use the general schema structure
   - Generates a PDF using a library like `pdfkit` or `jsPDF`
   - Returns the PDF as a blob
3. The PDF should include:
   - Title: "מסד נתונים - תרגיל 3"
   - For each table (Students, Courses, Lecturers, Enrollments):
     - Table name
     - Column definitions (name, type)
     - Sample data (if available) or indication of data presence
4. Button should trigger download of the generated PDF

**Files to Modify**:
- `app/homework/runner/[setId]/RunnerClient.tsx` - Add download button
- Create: `app/api/homework/[setId]/database-pdf/route.ts` - PDF generation endpoint
- May need to install: `pdfkit` or similar PDF library

---

#### Task 1.2: Fix Question Text Display
**Location**: `app/homework/runner/[setId]/RunnerClient.tsx`

**Description**: 
Some questions show only the schema (expectedResultSchema) but hide the actual question text. Ensure all question text is fully visible and readable.

**Implementation Steps**:
1. Investigate where questions are displayed (likely in the workspace header section around line 592-594)
2. Check the Question interface in `app/homework/types.ts` - ensure `prompt` and `instructions` fields are displayed
3. Verify that `activeQuestion?.prompt` and `activeQuestion?.instructions` are both rendered
4. If schema is being shown instead of question text, fix the display logic to show:
   - `question.prompt` - The main question text
   - `question.instructions` - Additional instructions
   - Only show schema if explicitly needed (maybe in a collapsible section)
5. Test with questions 1-10 to ensure all are readable

**Files to Modify**:
- `app/homework/runner/[setId]/RunnerClient.tsx` - Question display section (around line 592-597)

---

#### Task 1.3: Replace Green Checkmark with Blue Lightning Bolt
**Location**: `app/homework/runner/[setId]/RunnerClient.tsx` and related CSS

**Description**: 
After running a query successfully, replace the green checkmark (✓) with a blue lightning bolt icon (⚡), similar to MySQL's execution indicator.

**Implementation Steps**:
1. Find where the success indicator is shown after query execution
2. Look for:
   - Success icon rendering (might be in stepperCircle with '✓' character around line 581)
   - CSS classes related to success (`.successIcon`, `.stepperCircleCompleted`)
   - Any green checkmark emoji or icon
3. Replace with:
   - Blue lightning bolt emoji: ⚡
   - Or use an icon library icon (if available) styled in blue
4. Update CSS to:
   - Use blue color (#3b82f6 or similar) instead of green
   - Style the lightning bolt appropriately
5. Ensure it appears:
   - In the question stepper when a question is completed
   - In any success messages after query execution
   - Anywhere else a success checkmark currently appears

**Files to Modify**:
- `app/homework/runner/[setId]/RunnerClient.tsx` - Success indicator rendering
- `app/homework/runner/[setId]/runner.module.css` - Success icon styling

---

## Sprint 2: Student Interface - Michael Chat Integration

### Goal
Enhance the Michael chat assistant with homework context awareness.

### Todo List

#### Task 2.1: Inject Homework Context into Michael Chat
**Location**: `app/homework/runner/[setId]/RunnerClient.tsx`, `app/components/chat.tsx`

**Description**: 
When students use Michael chat in the homework runner, inject the homework context including:
- Database structure (all 4 tables with their schemas)
- All questions (1-10) with their prompts
- Current question context
- Student's assigned data (if needed)

**Implementation Steps**:
1. Modify the Chat component call in RunnerClient (around line 725) to pass context:
   - Add a `homeworkContext` prop or use existing context mechanism
   - Pass: homework object, questions array, studentTableData, current question
2. In `app/components/chat.tsx`:
   - Accept homework context props
   - Inject context into the assistant's system message or initial context
   - Format the context as:
     ```
     Database Schema:
     - Students (StudentID, FirstName, LastName, BirthDate, City, Email)
     - Courses (CourseID, CourseName, Credits, Department)
     - Lecturers (LecturerID, FirstName, LastName, City, HireDate, CourseID, Seniority)
     - Enrollments (StudentID, CourseID, EnrollmentDate, Grade)
     
     Questions:
     1. [Question 1 prompt]
     2. [Question 2 prompt]
     ...
     10. [Question 10 prompt]
     
     Current Question: [Current question prompt]
     ```
3. Update the assistant instructions to:
   - Reference the homework context when answering questions
   - Understand questions like "מה לעשות בשאלה מספר 12"
   - Provide relevant guidance based on the question context
4. Test that Michael can answer questions about specific question numbers

**Files to Modify**:
- `app/homework/runner/[setId]/RunnerClient.tsx` - Pass context to Chat component
- `app/components/chat.tsx` - Accept and use homework context
- Possibly: `app/api/assistants/threads/[threadId]/messages/route.ts` - If context needs to be injected at API level

---

## Sprint 3: Student Interface - Submission Flow & Verification

### Goal
Improve submission process and verify question content.

### Todo List

#### Task 3.1: Verify Questions 1-10 Match Exercise
**Location**: Database/Admin interface

**Description**: 
Verify that questions 1-10 in the homework set match the provided exercise document.

**Implementation Steps**:
1. Access the homework builder/admin interface for תרגיל 3
2. Review each question (1-10) and compare with the exercise document
3. Ensure:
   - Question prompts match
   - Instructions are correct
   - Expected schemas are appropriate
   - Point values are correct
4. If discrepancies found:
   - Update questions via admin interface
   - Document any changes needed
5. Create a checklist/verification document if needed

**Files to Review**:
- Admin interface: `/homework/builder/[setId]` or similar
- Question management interface
- Database: `homework_sets` collection

---

#### Task 3.2: Add AI Commitment Window and PDF Attachment
**Location**: `app/homework/runner/[setId]/RunnerClient.tsx`, `app/api/submissions/[setId]/submit/route.ts`

**Description**: 
After student clicks "הגש" and then "כן, הגש", show an additional dialog requiring:
- Student commitment statement about AI tool usage
- Option to upload conversation/file or check a checkbox
- Generate PDF of submission and attach to submission email

**Implementation Steps**:
1. **Add Commitment Dialog State**:
   - Add `showCommitmentDialog` state (after `showConfirmDialog`)
   - Modify submit flow: Confirm → Commitment → Submit

2. **Create Commitment Dialog Component**:
   - Text: "אני הסטודנט [student name] מתחייב/ת שאם השתמשתי בכלי AI אחר אני מצרף את השיחה להלן (לצרף קובץ) או לסמן וי."
   - File upload input (optional)
   - Checkbox: "אישרתי שלא השתמשתי בכלי AI" or similar
   - Buttons: "אישור והגשה" / "ביטול"

3. **Update Submit Flow**:
   - First dialog: "האם אתה בטוח שברצונך להגיש?"
   - On confirm → Show commitment dialog
   - On commitment confirm → Proceed with submission

4. **PDF Generation for Submission**:
   - Create endpoint: `/api/submissions/[submissionId]/pdf`
   - Generate PDF containing:
     - Student info (name, ID)
     - Homework title
     - All questions with student's SQL answers
     - Timestamps
   - Use library like `pdfkit` or `jsPDF`

5. **Email Attachment**:
   - In `app/api/submissions/[setId]/submit/route.ts`
   - After submission, generate PDF
   - Attach PDF to submission confirmation email
   - Include uploaded AI conversation file (if provided) as attachment

6. **Store Commitment**:
   - Add field to Submission model: `aiCommitment?: { signed: boolean, fileAttached?: string, timestamp: string }`
   - Store commitment status in database

**Files to Modify**:
- `app/homework/runner/[setId]/RunnerClient.tsx` - Add commitment dialog
- `app/api/submissions/[setId]/submit/route.ts` - Email with PDF attachment
- Create: `app/api/submissions/[submissionId]/pdf/route.ts` - PDF generation
- `lib/models.ts` / `app/homework/types.ts` - Add aiCommitment field to Submission interface

---

## Sprint 4: Student Interface - Analytics & Performance

### Goal
Add performance tracking and optimize database connections.

### Todo List

#### Task 4.1: Student Performance Analytics per Question
**Location**: `app/homework/runner/[setId]/RunnerClient.tsx`, Analytics service, Database

**Description**: 
Track and store detailed analytics for each question including:
- Typing speed (characters per minute)
- Time spent on question
- Number of attempts
- Time to first execution
- Time between executions
- Query execution time
- And other relevant metrics

**Implementation Steps**:
1. **Create Analytics Schema**:
   - Design database collection/document structure:
     ```typescript
     interface QuestionAnalytics {
       submissionId: string;
       questionId: string;
       studentId: string;
       homeworkSetId: string;
       metrics: {
         timeSpent: number; // milliseconds
         typingSpeed: number; // characters per minute
         attempts: number;
         timeToFirstExecution: number; // milliseconds from question open to first run
         timeBetweenExecutions: number[]; // array of milliseconds between each execution
         queryExecutionTimes: number[]; // execution time for each query
         charactersTyped: number;
         editsCount: number;
         copyPasteCount: number; // if detectable
         startedAt: string; // ISO timestamp
         lastActivityAt: string;
       }
     }
     ```

2. **Track Events in RunnerClient**:
   - Question open: Record timestamp
   - Editor changes: Track typing (throttled)
   - Query execution: Record execution time
   - Question navigation: Calculate time spent
   - Use `useEffect` hooks to track:
     - Time when question becomes active
     - Time when student starts typing
     - Time between events

3. **Create Analytics Service**:
   - `lib/question-analytics.ts`:
     - `trackQuestionOpen(submissionId, questionId)`
     - `trackTyping(submissionId, questionId, characters)`
     - `trackExecution(submissionId, questionId, executionTime)`
     - `trackQuestionClose(submissionId, questionId)`
     - `saveAnalytics(analytics)` - Save to database

4. **API Endpoint**:
   - `POST /api/analytics/question` - Store analytics events
   - Or batch save: `POST /api/analytics/questions/batch`

5. **Database Storage**:
   - Store in `question_analytics` collection
   - Or embed in submission document under `questionAnalytics` field

6. **Calculate Metrics**:
   - Typing speed: (total characters / time spent) * 60 * 1000
   - Time spent: lastActivityAt - startedAt
   - Aggregate on question close or submission

**Files to Create/Modify**:
- Create: `lib/question-analytics.ts` - Analytics tracking service
- Create: `app/api/analytics/question/route.ts` - Analytics API endpoint
- Modify: `app/homework/runner/[setId]/RunnerClient.tsx` - Add tracking hooks
- Modify: `lib/models.ts` - Add analytics schema
- Database: Add collection or field for analytics

---

#### Task 4.2: Database Connection Optimization
**Location**: `lib/database.ts`, SQL execution routes, Connection pooling

**Description**: 
Optimize database connection management to prevent "You're nearing the maximum connections threshold" warnings when students execute queries.

**Implementation Steps**:
1. **Investigate Current Connection Usage**:
   - Check how connections are created in `lib/database.ts`
   - Identify where connections might not be closed
   - Check SQL execution routes for connection leaks

2. **Implement Connection Pooling**:
   - Ensure MongoDB connection uses proper pooling
   - Set appropriate pool size (e.g., maxPoolSize: 10-20)
   - Reuse connections where possible

3. **Close Connections Properly**:
   - Audit all database operations
   - Ensure connections are closed after use
   - Use try-finally blocks to guarantee cleanup
   - Check SQL execution code (alasql) for connection management

4. **Optimize Query Execution**:
   - Review `lib/submissions.ts` - `executeSqlForSubmission` method
   - Ensure alasql instances are properly managed
   - Consider connection pooling for alasql if applicable
   - Batch operations where possible

5. **Add Connection Monitoring**:
   - Log connection pool usage
   - Add warnings when pool is near capacity
   - Monitor connection leaks

6. **Consider Alternatives**:
   - Use connection string with proper pooling parameters
   - Implement connection reuse patterns
   - Consider read replicas if needed
   - Cache frequently accessed data

**Files to Modify**:
- `lib/database.ts` - Connection pool configuration
- `lib/submissions.ts` - SQL execution optimization
- `app/api/sql/execute/route.ts` - Connection management
- Any other files that create database connections

---

## Sprint 5: Grading Interface Improvements

### Goal
Enhance the grading interface with better student identification, export capabilities, and comment management.

### Todo List

#### Task 5.1: Change Database ID to Student ID Number (ת.ז)
**Location**: Grading interface, Student identification

**Description**: 
In the grading interface, change the student identifier from database ID to student ID number (ת.ז - Israeli ID number).

**Implementation Steps**:
1. **Identify Current ID Usage**:
   - Check grading interface: `app/homework/builder/[setId]/grade/GradeHomeworkClient.tsx`
   - Find where studentId is displayed
   - Check if studentId is email, ObjectId, or other format

2. **Get Student ID Number**:
   - Check User/Student model for ID number field
   - May need to add `idNumber` or `studentIdNumber` field if not exists
   - Query user by current studentId to get ID number

3. **Update Display**:
   - Modify grading interface to show ת.ז instead of studentId
   - Update student list display
   - Update submission view headers
   - Ensure search/filter works with ID number

4. **Update Data Fetching**:
   - Modify queries to include student ID number
   - May need to join with users collection
   - Update API endpoints if needed

5. **Handle Missing ID Numbers**:
   - Show fallback (email or current ID) if ID number not available
   - Add migration/update script if needed

**Files to Modify**:
- `app/homework/builder/[setId]/grade/GradeHomeworkClient.tsx` - Display ID number
- Possibly: `app/api/submissions/[setId]/summaries/route.ts` - Include ID number in response
- `lib/models.ts` - Add idNumber field if needed
- User/Student data model - Ensure ID number is stored

---

#### Task 5.2: Excel Export for Grading Results
**Location**: `app/homework/builder/[setId]/grade/GradeHomeworkClient.tsx`

**Description**: 
Add functionality to export grading results to Excel with:
- Each student in a row
- Columns: Student ID (ת.ז), Name, Score per question (Q1, Q2, ..., Q10), Total Score, Comments per question

**Implementation Steps**:
1. **Install Excel Library**:
   - Install: `xlsx` or `exceljs` package
   - `npm install xlsx` or `npm install exceljs`

2. **Add Export Button**:
   - Add "ייצא לאקסל" button in grading interface
   - Place near other action buttons (Save grading, Publish grades)

3. **Create Export Function**:
   - Fetch all submissions for the homework set
   - For each submission:
     - Get student ID number (ת.ז)
     - Get student name
     - Extract scores for each question from `answers` object
     - Extract comments/instructor notes for each question
     - Calculate total score

4. **Generate Excel File**:
   - Create worksheet with headers:
     - ת.ז, שם, שאלה 1 (ניקוד), שאלה 1 (הערה), שאלה 2 (ניקוד), שאלה 2 (הערה), ..., סה"כ
   - Add data rows
   - Format appropriately (RTL for Hebrew, column widths)

5. **Download File**:
   - Trigger download in browser
   - Filename: `תרגיל-3-הגשות-${date}.xlsx`

6. **Handle Edge Cases**:
   - Missing scores (show 0 or empty)
   - Missing comments (empty cell)
   - Students with no submission
   - Multiple attempts (use latest or best)

**Files to Modify**:
- `app/homework/builder/[setId]/grade/GradeHomeworkClient.tsx` - Add export button and function
- Possibly create: `lib/excel-export.ts` - Reusable Excel export utility
- `package.json` - Add xlsx/exceljs dependency

---

#### Task 5.3: Comment Bank System
**Location**: `app/homework/builder/[setId]/grade/GradeHomeworkClient.tsx`, Database

**Description**: 
Create a comment bank system where graders can:
- Save frequently used comments for each question
- Reuse comments with associated scores
- Build a library of comments to maximize grading efficiency

**Implementation Steps**:
1. **Design Comment Bank Schema**:
   ```typescript
   interface CommentBankEntry {
     questionId: string;
     comment: string;
     score: number; // Associated score (e.g., 8/10)
     category?: string; // Optional: "syntax error", "logic error", "correct", etc.
     usageCount: number;
     createdAt: string;
     updatedAt: string;
   }
   ```

2. **Create Comment Bank Storage**:
   - Create collection: `comment_bank` or add to homework set document
   - Store entries keyed by `homeworkSetId` and `questionId`

3. **Add UI Components**:
   - In grading interface, near comment input for each question:
     - "שמור הערה" button (save current comment+score to bank)
     - "הערות נפוצות" dropdown/button (show saved comments)
     - List of saved comments with scores
     - Click to apply comment+score

4. **Implement Save Comment**:
   - When grader clicks "שמור הערה":
     - Extract current comment text and score
     - Save to comment bank
     - Show confirmation

5. **Implement Use Comment**:
   - Show saved comments in a dropdown/modal
   - Display: comment text + score
   - On click: Fill comment field and score field
   - Increment usageCount

6. **Comment Bank Management**:
   - View all saved comments
   - Edit/delete comments
   - Search/filter comments
   - Show usage statistics

7. **API Endpoints**:
   - `POST /api/comment-bank` - Save comment
   - `GET /api/comment-bank?homeworkSetId=X&questionId=Y` - Get comments
   - `PUT /api/comment-bank/:id` - Update comment
   - `DELETE /api/comment-bank/:id` - Delete comment

**Files to Create/Modify**:
- Create: `app/api/comment-bank/route.ts` - Comment bank API
- Create: `lib/comment-bank.ts` - Comment bank service
- Modify: `app/homework/builder/[setId]/grade/GradeHomeworkClient.tsx` - Add comment bank UI
- Modify: `lib/models.ts` - Add CommentBankEntry interface
- Database: Create comment_bank collection or add to schema

---

## Sprint 6: UI Fixes - Chat Sidebar Scrollability

### Goal
Fix the chat sidebar (Michael) scrollability issue in the homework runner interface.

### Todo List

#### Task 6.1: Fix Chat Sidebar Scrollability
**Location**: `app/homework/runner/[setId]/runner.module.css`, `app/homework/runner/[setId]/RunnerClient.tsx`

**Description**: 
The left sidebar containing the Michael chat interface is not scrollable, while the right sidebar (Instructions) and middle column (SQL editor) scroll correctly.

**Implementation Steps**:
1. **Investigate CSS Flexbox Chain**:
   - Review the flexbox hierarchy: `.chatSidebar` → `.chatContent` → Chat component → `.messages`
   - Ensure each level in the chain properly constrains height
   - Verify `min-height: 0` and `flex: 1 1 0` are applied correctly

2. **Fix Flexbox Constraints**:
   - Ensure `.chatContent` has proper `overflow: hidden` to constrain children
   - Update nested Chat component styles (`.main`, `.container`, `.chatContainer`, `.messages`)
   - Apply flexbox trick: `flex: 1 1 0`, `min-height: 0`, `height: 0` at each level
   - Ensure `.messages` has `overflow-y: auto` to enable scrolling

3. **Test Scrollability**:
   - Add multiple messages to trigger scroll
   - Verify scrollbar appears when content overflows
   - Ensure smooth scrolling behavior
   - Test on different screen sizes

**Files to Modify**:
- `app/homework/runner/[setId]/runner.module.css` - Fix flexbox chain for chat sidebar
- May need to override Chat component styles with `:global()` selectors

---

## Summary

### Sprint Breakdown:
- **Sprint 1**: Core UI improvements (3 tasks)
- **Sprint 2**: Michael chat integration (1 task)
- **Sprint 3**: Submission flow & verification (2 tasks)
- **Sprint 4**: Analytics & performance (2 tasks)
- **Sprint 5**: Grading interface (3 tasks)
- **Sprint 6**: UI Fixes - Chat sidebar scrollability (1 task)

### Total Tasks: 12

### Priority Order:
1. Sprint 1 - Core functionality first
2. Sprint 3 - Submission flow (critical for students)
3. Sprint 2 - Chat integration (enhances UX)
4. Sprint 5 - Grading improvements (for instructors)
5. Sprint 4 - Analytics & optimization (performance improvements)
6. Sprint 6 - UI fixes (chat sidebar scrollability)

### Notes:
- Some tasks may require database schema changes - ensure migrations are created
- Test thoroughly after each sprint
- Consider backward compatibility for existing data
- Document API changes
- Update TypeScript types as needed
