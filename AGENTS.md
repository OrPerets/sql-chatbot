# Student-Specific Table Data Assignment for HW3

## ✅ IMPLEMENTATION COMPLETED - December 19, 2025

**Status:** Fully implemented and tested  
**Documentation:** See `docs/hw3-student-data-assignment-implementation.md`  
**Tests:** All 16 tests passing in `__tests__/lib/student-data-assignment.test.ts`

### Quick Summary
- ✅ Each student receives 15-20 rows per table (Students, Courses, Lecturers, Enrollments)
- ✅ Data is unique per student (deterministic random assignment)
- ✅ Data is persistent and consistent across sessions
- ✅ Data stored in submission document (`studentTableData` field)
- ✅ API endpoint for grading: `GET /api/submissions/by-id/[submissionId]/table-data`
- ✅ Fully tested with comprehensive unit tests

### Key Files
- `lib/student-data-assignment.ts` - Core assignment logic
- `lib/submissions.ts` - Integration with submission service
- `app/api/submissions/by-id/[submissionId]/table-data/route.ts` - Grading API
- `__tests__/lib/student-data-assignment.test.ts` - Comprehensive tests

---

## Problem Statement (Original Requirements)

The homework runner route `/homework/runner/[id]` is used for students to perform HW3 (תרגיל 3). The exercise contains 4 tables with many rows:
- `Students` (currently ~40 rows)
- `Courses` (currently ~22 rows)
- `Lecturers` (currently ~22 rows)
- `Enrollments` (currently many rows)

**Requirements:**
1. Each student should receive a **random subset of 15-20 rows** from each of the 4 tables
2. Each student should get **different data** from other students (to prevent copying)
3. The assignment must be **consistent and persistent**:
   - Same student gets same data on page refresh
   - Same student gets same data after logout/login
   - Same student gets same data across different sessions
4. The assigned data must be **stored** so instructors can check/grade submissions using the student's specific tables

## Current Implementation

### Location
- **SQL Execution**: `lib/submissions.ts` → `executeSqlForSubmission()` method
- **Data Initialization**: `initializeExercise3Data()` function (lines ~439-680)
- **Submission Model**: `app/homework/types.ts` → `Submission` interface
- **Database Model**: `lib/models.ts` → `SubmissionModel` interface

### Current Behavior
- All students see the **same full dataset** (all rows from all tables)
- Data is hardcoded in `initializeExercise3Data()` function
- Data is re-initialized on every SQL execution (not persistent)
- No student-specific data assignment exists

## Required Changes

### 1. Data Structure Changes

#### A. Update Submission Model
Add a new field to store student-specific table data:

**File**: `app/homework/types.ts`
```typescript
export interface StudentTableData {
  tableName: string;
  rows: any[]; // Array of row objects
  assignedAt: string; // Timestamp when data was assigned
}

export interface Submission {
  // ... existing fields ...
  studentTableData?: Record<string, StudentTableData[]>; // Key: table name, Value: array of row data
  // OR store as:
  // studentTableData?: {
  //   Students?: any[];
  //   Courses?: any[];
  //   Lecturers?: any[];
  //   Enrollments?: any[];
  // };
}
```

**File**: `lib/models.ts`
- Update `SubmissionModel` interface to match

### 2. Data Assignment Logic

#### A. Create Data Assignment Service
**New File**: `lib/student-data-assignment.ts` (or add to `lib/submissions.ts`)

**Functions needed:**
1. `assignStudentTableData(studentId: string, homeworkSetId: string): Promise<StudentTableData[]>`
   - Check if student already has assigned data (in submission)
   - If yes, return existing assignment
   - If no, generate random subset (15-20 rows per table) and store it
   - Use deterministic random seed based on `studentId + homeworkSetId` for consistency

2. `getStudentTableData(studentId: string, homeworkSetId: string): Promise<StudentTableData[] | null>`
   - Retrieve existing assignment from submission

3. `generateRandomSubset(fullData: any[], count: number, seed: string): any[]`
   - Generate deterministic random subset using seed
   - Use a seeded random number generator (e.g., `seedrandom` library or custom implementation)

#### B. Full Dataset Storage
Store the full dataset somewhere accessible:
- Option 1: In the dataset collection (if HW3 has a dataset entry)
- Option 2: In a constant/configuration file
- Option 3: In the homework set metadata

**Recommended**: Create a dataset entry for HW3 with all the full table data, then extract subsets from it.

### 3. SQL Execution Changes

#### File: `lib/submissions.ts` → `executeSqlForSubmission()`

**Current flow:**
1. Get question and homework set
2. Get dataset
3. Call `initializeExercise3Data()` which inserts all hardcoded data
4. Execute SQL against full dataset

**New flow:**
1. Get question and homework set
2. Get dataset
3. **Check if student has assigned table data:**
   - If submission exists and has `studentTableData`, use it
   - If not, call `assignStudentTableData()` to generate and store assignment
4. **Initialize only student's assigned data** (not full dataset)
5. Execute SQL against student's subset

**Implementation:**
```typescript
// In executeSqlForSubmission(), replace initializeExercise3Data() call with:

// Get or assign student-specific data
const studentData = await this.getOrAssignStudentTableData(
  payload.studentId, 
  payload.setId
);

// Initialize only student's data
this.initializeStudentSpecificData(alasql, studentData);
```

### 4. Submission Creation/Retrieval Changes

#### File: `lib/submissions.ts`

**In `saveSubmissionDraft()`:**
- When creating new submission, check if student needs table data assignment
- If yes, assign data and store in `studentTableData` field
- Ensure assignment happens on first access, not on every save

**In `getSubmissionForStudent()`:**
- Return submission with `studentTableData` if it exists

**New method:**
```typescript
async getOrAssignStudentTableData(
  studentId: string, 
  homeworkSetId: string
): Promise<StudentTableData[]> {
  // Get existing submission
  const submission = await this.getSubmissionForStudent(homeworkSetId, studentId);
  
  // If submission exists and has data, return it
  if (submission?.studentTableData) {
    return submission.studentTableData;
  }
  
  // Otherwise, generate new assignment
  const assignedData = await this.assignStudentTableData(studentId, homeworkSetId);
  
  // Save to submission (create if doesn't exist)
  await this.saveSubmissionDraft(homeworkSetId, {
    studentId,
    answers: {},
  });
  
  // Update submission with assigned data
  await this.updateSubmissionTableData(homeworkSetId, studentId, assignedData);
  
  return assignedData;
}
```

### 5. Deterministic Random Selection

**Important**: Use a seeded random number generator to ensure:
- Same `studentId + homeworkSetId` always produces same subset
- Different students get different subsets
- Assignment is reproducible

**Library option**: Use `seedrandom` npm package:
```typescript
import seedrandom from 'seedrandom';

function generateRandomSubset<T>(fullData: T[], count: number, seed: string): T[] {
  const rng = seedrandom(seed);
  const shuffled = [...fullData].sort(() => rng() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}
```

**Or custom implementation:**
```typescript
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  let value = Math.abs(hash);
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}
```

### 6. Row Count Selection

For each table, randomly select between 15-20 rows:
```typescript
function getRowCount(seed: string, tableName: string): number {
  const rng = seedrandom(`${seed}-${tableName}`);
  return 15 + Math.floor(rng() * 6); // 15-20 inclusive
}
```

## Implementation Steps

1. **Install dependencies** (if using seedrandom):
   ```bash
   npm install seedrandom
   npm install --save-dev @types/seedrandom
   ```

2. **Update TypeScript types**:
   - Add `StudentTableData` interface
   - Update `Submission` interface
   - Update `SubmissionModel` interface

3. **Create data assignment service**:
   - Implement `assignStudentTableData()`
   - Implement `getStudentTableData()`
   - Implement `generateRandomSubset()`
   - Store full dataset (either in dataset collection or as constant)

4. **Modify SQL execution**:
   - Update `executeSqlForSubmission()` to use student-specific data
   - Replace `initializeExercise3Data()` with `initializeStudentSpecificData()`
   - Ensure data is loaded from stored assignment

5. **Update submission service**:
   - Add `getOrAssignStudentTableData()` method
   - Update `saveSubmissionDraft()` to handle table data assignment
   - Update `getSubmissionForStudent()` to return table data

6. **Testing**:
   - Test that same student gets same data on refresh
   - Test that different students get different data
   - Test that data persists after logout/login
   - Test SQL execution works with subset data
   - Test grading can access student's specific data

## Data Storage Format

**Recommended structure in Submission:**
```typescript
{
  studentTableData: {
    Students: [
      { StudentID: '87369214', FirstName: 'John', ... },
      { StudentID: '194DEF23', FirstName: 'Jane', ... },
      // ... 15-20 rows
    ],
    Courses: [
      { CourseID: 101, CourseName: 'Introduction to CS', ... },
      // ... 15-20 rows
    ],
    Lecturers: [
      { LecturerID: 'ABC95716', FirstName: 'Alice', ... },
      // ... 15-20 rows
    ],
    Enrollments: [
      { StudentID: '87369214', CourseID: 101, ... },
      // ... 15-20 rows
    ]
  }
}
```

## Grading Considerations

When grading submissions, instructors need to:
1. Access the student's specific table data
2. Execute the student's SQL against their specific data
3. Verify results are correct for their dataset

**API endpoint needed**: 
- `GET /api/submissions/[submissionId]/table-data` - Returns student's assigned table data
- Or include in existing submission retrieval endpoints

**Grading interface updates**:
- Display student's table data in grading view
- Allow instructors to see what data the student worked with
- Execute SQL against student's data for verification

## Edge Cases to Handle

1. **Student accesses homework before submission is created**:
   - Assignment should happen on first SQL execution or first submission access
   
2. **Multiple attempts**:
   - Same data should be used across all attempts (don't regenerate)
   
3. **Data consistency**:
   - If full dataset changes, existing assignments should remain unchanged
   - Consider versioning if dataset updates are needed
   
4. **Enrollments table**:
   - Must only include enrollments for students/courses in the assigned subsets
   - Filter enrollments to match assigned Students and Courses

## Notes

- The current hardcoded data in `initializeExercise3Data()` should be extracted to a reusable constant or dataset entry
- Consider creating a migration script to assign data to existing submissions
- The assignment should be deterministic but appear random to students
- Row count (15-20) should be configurable per homework set if needed

