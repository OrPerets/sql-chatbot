import { 
  assignStudentTableData, 
  generateRandomSubset,
  EXERCISE3_FULL_DATASET 
} from '@/lib/student-data-assignment';

describe('Student Data Assignment', () => {
  describe('generateRandomSubset', () => {
    it('should generate a deterministic subset based on seed', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const seed = 'test-seed';
      
      const subset1 = generateRandomSubset(data, 5, seed);
      const subset2 = generateRandomSubset(data, 5, seed);
      
      // Same seed should produce same results
      expect(subset1).toEqual(subset2);
      expect(subset1.length).toBe(5);
    });

    it('should generate different subsets for different seeds', () => {
      const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      
      const subset1 = generateRandomSubset(data, 5, 'seed1');
      const subset2 = generateRandomSubset(data, 5, 'seed2');
      
      // Different seeds should produce different results (with high probability)
      expect(subset1).not.toEqual(subset2);
    });

    it('should not exceed requested count', () => {
      const data = [1, 2, 3, 4, 5];
      const subset = generateRandomSubset(data, 10, 'test-seed');
      
      expect(subset.length).toBeLessThanOrEqual(5);
    });
  });

  describe('assignStudentTableData', () => {
    it('should assign data for all 4 tables', () => {
      const studentId = 'student123';
      const homeworkSetId = 'hw456';
      
      const tableData = assignStudentTableData(studentId, homeworkSetId);
      
      expect(tableData).toHaveProperty('Students');
      expect(tableData).toHaveProperty('Courses');
      expect(tableData).toHaveProperty('Lecturers');
      expect(tableData).toHaveProperty('Enrollments');
    });

    it('should assign 15-20 rows per table', () => {
      const studentId = 'student123';
      const homeworkSetId = 'hw456';
      
      const tableData = assignStudentTableData(studentId, homeworkSetId);
      
      expect(tableData.Students.length).toBeGreaterThanOrEqual(15);
      expect(tableData.Students.length).toBeLessThanOrEqual(20);
      
      expect(tableData.Courses.length).toBeGreaterThanOrEqual(15);
      expect(tableData.Courses.length).toBeLessThanOrEqual(20);
      
      expect(tableData.Lecturers.length).toBeGreaterThanOrEqual(15);
      expect(tableData.Lecturers.length).toBeLessThanOrEqual(20);
      
      // Enrollments might be less if there aren't enough valid combinations
      expect(tableData.Enrollments.length).toBeGreaterThan(0);
    });

    it('should assign same data for same student and homework', () => {
      const studentId = 'student123';
      const homeworkSetId = 'hw456';
      
      const tableData1 = assignStudentTableData(studentId, homeworkSetId);
      const tableData2 = assignStudentTableData(studentId, homeworkSetId);
      
      expect(tableData1).toEqual(tableData2);
    });

    it('should assign different data for different students', () => {
      const homeworkSetId = 'hw456';
      
      const tableData1 = assignStudentTableData('student1', homeworkSetId);
      const tableData2 = assignStudentTableData('student2', homeworkSetId);
      
      // Check that at least some data is different
      const student1Ids = tableData1.Students.map(s => s.StudentID).sort();
      const student2Ids = tableData2.Students.map(s => s.StudentID).sort();
      
      expect(student1Ids).not.toEqual(student2Ids);
    });

    it('should assign different data for same student in different homework sets', () => {
      const studentId = 'student123';
      
      const tableData1 = assignStudentTableData(studentId, 'hw1');
      const tableData2 = assignStudentTableData(studentId, 'hw2');
      
      // Check that at least some data is different
      const hw1Ids = tableData1.Students.map(s => s.StudentID).sort();
      const hw2Ids = tableData2.Students.map(s => s.StudentID).sort();
      
      expect(hw1Ids).not.toEqual(hw2Ids);
    });

    it('should only include valid enrollments (matching assigned students and courses)', () => {
      const studentId = 'student123';
      const homeworkSetId = 'hw456';
      
      const tableData = assignStudentTableData(studentId, homeworkSetId);
      
      const assignedStudentIds = new Set(tableData.Students.map(s => s.StudentID));
      const assignedCourseIds = new Set(tableData.Courses.map(c => c.CourseID));
      
      // All enrollments should reference assigned students and courses
      tableData.Enrollments.forEach(enrollment => {
        expect(assignedStudentIds.has(enrollment.StudentID)).toBe(true);
        expect(assignedCourseIds.has(enrollment.CourseID)).toBe(true);
      });
    });

    it('should use data from the full dataset', () => {
      const studentId = 'student123';
      const homeworkSetId = 'hw456';
      
      const tableData = assignStudentTableData(studentId, homeworkSetId);
      
      // Check that assigned students are from the full dataset
      const fullStudentIds = new Set(EXERCISE3_FULL_DATASET.Students.map(s => s.StudentID));
      tableData.Students.forEach(student => {
        expect(fullStudentIds.has(student.StudentID)).toBe(true);
      });
      
      // Check that assigned courses are from the full dataset
      const fullCourseIds = new Set(EXERCISE3_FULL_DATASET.Courses.map(c => c.CourseID));
      tableData.Courses.forEach(course => {
        expect(fullCourseIds.has(course.CourseID)).toBe(true);
      });
    });
  });

  describe('Full Dataset', () => {
    it('should have all required tables', () => {
      expect(EXERCISE3_FULL_DATASET).toHaveProperty('Students');
      expect(EXERCISE3_FULL_DATASET).toHaveProperty('Courses');
      expect(EXERCISE3_FULL_DATASET).toHaveProperty('Lecturers');
      expect(EXERCISE3_FULL_DATASET).toHaveProperty('Enrollments');
    });

    it('should have sufficient data in each table', () => {
      expect(EXERCISE3_FULL_DATASET.Students.length).toBeGreaterThanOrEqual(40);
      expect(EXERCISE3_FULL_DATASET.Courses.length).toBeGreaterThanOrEqual(20);
      expect(EXERCISE3_FULL_DATASET.Lecturers.length).toBeGreaterThanOrEqual(20);
      expect(EXERCISE3_FULL_DATASET.Enrollments.length).toBeGreaterThan(0);
    });

    it('should have valid student data structure', () => {
      const student = EXERCISE3_FULL_DATASET.Students[0];
      expect(student).toHaveProperty('StudentID');
      expect(student).toHaveProperty('FirstName');
      expect(student).toHaveProperty('LastName');
      expect(student).toHaveProperty('BirthDate');
      expect(student).toHaveProperty('City');
      expect(student).toHaveProperty('Email');
    });

    it('should have valid course data structure', () => {
      const course = EXERCISE3_FULL_DATASET.Courses[0];
      expect(course).toHaveProperty('CourseID');
      expect(course).toHaveProperty('CourseName');
      expect(course).toHaveProperty('Credits');
      expect(course).toHaveProperty('Department');
    });

    it('should have valid lecturer data structure', () => {
      const lecturer = EXERCISE3_FULL_DATASET.Lecturers[0];
      expect(lecturer).toHaveProperty('LecturerID');
      expect(lecturer).toHaveProperty('FirstName');
      expect(lecturer).toHaveProperty('LastName');
      expect(lecturer).toHaveProperty('City');
      expect(lecturer).toHaveProperty('HireDate');
      expect(lecturer).toHaveProperty('CourseID');
      expect(lecturer).toHaveProperty('Seniority');
    });

    it('should have valid enrollment data structure', () => {
      const enrollment = EXERCISE3_FULL_DATASET.Enrollments[0];
      expect(enrollment).toHaveProperty('StudentID');
      expect(enrollment).toHaveProperty('CourseID');
      expect(enrollment).toHaveProperty('EnrollmentDate');
      expect(enrollment).toHaveProperty('Grade');
    });
  });
});

