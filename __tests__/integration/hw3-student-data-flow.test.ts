/**
 * Integration test for HW3 student-specific data assignment flow
 * Tests the complete flow from SQL execution to data persistence
 */

import { assignStudentTableData } from '@/lib/student-data-assignment';

describe('HW3 Student Data Assignment - Integration', () => {

  describe('Student Data Assignment Flow', () => {
    it('should assign different data to different students', () => {
      const homeworkSetId = 'hw-exercise3';
      
      const student1Data = assignStudentTableData('student-1', homeworkSetId);
      const student2Data = assignStudentTableData('student-2', homeworkSetId);
      
      // Check that students got different data
      const student1Ids = student1Data.Students.map(s => s.StudentID).sort();
      const student2Ids = student2Data.Students.map(s => s.StudentID).sort();
      
      expect(student1Ids).not.toEqual(student2Ids);
    });

    it('should maintain data consistency across multiple calls', async () => {
      const studentId = 'consistent-student';
      const homeworkSetId = 'hw-exercise3';
      
      // Generate data multiple times with same parameters
      const data1 = assignStudentTableData(studentId, homeworkSetId);
      const data2 = assignStudentTableData(studentId, homeworkSetId);
      const data3 = assignStudentTableData(studentId, homeworkSetId);
      
      // All should be identical
      expect(data1).toEqual(data2);
      expect(data2).toEqual(data3);
      
      // Verify specific properties are consistent
      expect(data1.Students.length).toBe(data2.Students.length);
      expect(data1.Courses.length).toBe(data2.Courses.length);
      expect(data1.Lecturers.length).toBe(data2.Lecturers.length);
      expect(data1.Enrollments.length).toBe(data2.Enrollments.length);
    });

    it('should respect row count constraints (15-20 per table)', async () => {
      const studentId = 'test-student';
      const homeworkSetId = 'hw-exercise3';
      
      const data = assignStudentTableData(studentId, homeworkSetId);
      
      // Check Students
      expect(data.Students.length).toBeGreaterThanOrEqual(15);
      expect(data.Students.length).toBeLessThanOrEqual(20);
      
      // Check Courses
      expect(data.Courses.length).toBeGreaterThanOrEqual(15);
      expect(data.Courses.length).toBeLessThanOrEqual(20);
      
      // Check Lecturers
      expect(data.Lecturers.length).toBeGreaterThanOrEqual(15);
      expect(data.Lecturers.length).toBeLessThanOrEqual(20);
      
      // Enrollments might be less if not enough valid combinations
      expect(data.Enrollments.length).toBeGreaterThan(0);
    });

    it('should only include valid enrollments', async () => {
      const studentId = 'test-student';
      const homeworkSetId = 'hw-exercise3';
      
      const data = assignStudentTableData(studentId, homeworkSetId);
      
      const assignedStudentIds = new Set(data.Students.map(s => s.StudentID));
      const assignedCourseIds = new Set(data.Courses.map(c => c.CourseID));
      
      // Every enrollment must reference an assigned student and course
      data.Enrollments.forEach(enrollment => {
        expect(assignedStudentIds.has(enrollment.StudentID)).toBe(true);
        expect(assignedCourseIds.has(enrollment.CourseID)).toBe(true);
      });
    });

    it('should handle multiple homework sets independently', async () => {
      const studentId = 'multi-hw-student';
      
      const hw1Data = assignStudentTableData(studentId, 'hw1');
      const hw2Data = assignStudentTableData(studentId, 'hw2');
      const hw3Data = assignStudentTableData(studentId, 'hw3');
      
      // Each homework should get different data
      const hw1StudentIds = hw1Data.Students.map(s => s.StudentID).sort().join(',');
      const hw2StudentIds = hw2Data.Students.map(s => s.StudentID).sort().join(',');
      const hw3StudentIds = hw3Data.Students.map(s => s.StudentID).sort().join(',');
      
      expect(hw1StudentIds).not.toBe(hw2StudentIds);
      expect(hw2StudentIds).not.toBe(hw3StudentIds);
      expect(hw1StudentIds).not.toBe(hw3StudentIds);
    });

    it('should preserve data structure integrity', async () => {
      const studentId = 'structure-test-student';
      const homeworkSetId = 'hw-exercise3';
      
      const data = assignStudentTableData(studentId, homeworkSetId);
      
      // Verify Students structure
      data.Students.forEach(student => {
        expect(student).toHaveProperty('StudentID');
        expect(student).toHaveProperty('FirstName');
        expect(student).toHaveProperty('LastName');
        expect(student).toHaveProperty('BirthDate');
        expect(student).toHaveProperty('City');
        expect(student).toHaveProperty('Email');
        expect(typeof student.StudentID).toBe('string');
        expect(typeof student.FirstName).toBe('string');
      });
      
      // Verify Courses structure
      data.Courses.forEach(course => {
        expect(course).toHaveProperty('CourseID');
        expect(course).toHaveProperty('CourseName');
        expect(course).toHaveProperty('Credits');
        expect(course).toHaveProperty('Department');
        expect(typeof course.CourseID).toBe('number');
        expect(typeof course.CourseName).toBe('string');
      });
      
      // Verify Lecturers structure
      data.Lecturers.forEach(lecturer => {
        expect(lecturer).toHaveProperty('LecturerID');
        expect(lecturer).toHaveProperty('FirstName');
        expect(lecturer).toHaveProperty('LastName');
        expect(lecturer).toHaveProperty('City');
        expect(lecturer).toHaveProperty('HireDate');
        expect(lecturer).toHaveProperty('CourseID');
        expect(lecturer).toHaveProperty('Seniority');
      });
      
      // Verify Enrollments structure
      data.Enrollments.forEach(enrollment => {
        expect(enrollment).toHaveProperty('StudentID');
        expect(enrollment).toHaveProperty('CourseID');
        expect(enrollment).toHaveProperty('EnrollmentDate');
        expect(enrollment).toHaveProperty('Grade');
        expect(typeof enrollment.Grade).toBe('number');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle students with special characters in IDs', async () => {
      const specialStudentIds = [
        'student+test@example.com',
        'student.name@example.com',
        'student_123',
        'student-456',
      ];
      
      const homeworkSetId = 'hw-exercise3';
      
      specialStudentIds.forEach(studentId => {
        const data = assignStudentTableData(studentId, homeworkSetId);
        expect(data).toHaveProperty('Students');
        expect(data.Students.length).toBeGreaterThan(0);
      });
    });

    it('should handle very long student IDs', async () => {
      const longStudentId = 'a'.repeat(100);
      const homeworkSetId = 'hw-exercise3';
      
      const data = assignStudentTableData(longStudentId, homeworkSetId);
      expect(data).toHaveProperty('Students');
      expect(data.Students.length).toBeGreaterThanOrEqual(15);
    });

    it('should produce consistent results regardless of call order', async () => {
      const students = ['student-a', 'student-b', 'student-c'];
      const homeworkSetId = 'hw-exercise3';
      
      // First pass
      const firstPass = students.map(id => assignStudentTableData(id, homeworkSetId));
      
      // Second pass in different order
      const secondPass = [...students].reverse().map(id => assignStudentTableData(id, homeworkSetId));
      
      // Results should match regardless of order
      expect(firstPass[0]).toEqual(secondPass[2]); // student-a
      expect(firstPass[1]).toEqual(secondPass[1]); // student-b
      expect(firstPass[2]).toEqual(secondPass[0]); // student-c
    });
  });

  describe('Performance', () => {
    it('should complete assignment in reasonable time', () => {
      const studentId = 'perf-test-student';
      const homeworkSetId = 'hw-exercise3';
      
      const startTime = Date.now();
      assignStudentTableData(studentId, homeworkSetId);
      const endTime = Date.now();
      
      const duration = endTime - startTime;
      
      // Should complete in less than 100ms
      expect(duration).toBeLessThan(100);
    });

    it('should handle multiple assignments efficiently', () => {
      const homeworkSetId = 'hw-exercise3';
      const studentCount = 50;
      
      const startTime = Date.now();
      
      for (let i = 0; i < studentCount; i++) {
        assignStudentTableData(`student-${i}`, homeworkSetId);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      const avgPerStudent = duration / studentCount;
      
      // Average should be less than 10ms per student
      expect(avgPerStudent).toBeLessThan(10);
    });
  });
});

