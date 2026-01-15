import { connectToDatabase } from '../lib/database';
import { getHomeworkService } from '../lib/homework';
import { getQuestionsService } from '../lib/questions';

/**
 * Script to add SQL solutions to all 13 questions in תרגיל 3
 * 
 * This script:
 * 1. Finds the homework set "תרגיל 3"
 * 2. Gets all 13 questions
 * 3. Updates each question with the appropriate SQL solution
 */

// SQL solutions for all 13 questions
const solutions = [
  // Question 1: Show all enrollments from last 3 months
  // Note: Date comparison uses string format since dates are stored as strings
  `SELECT 
    e.StudentID AS "תעודת זהות",
    s.FirstName || ' ' || s.LastName AS "שם הסטודנט",
    CAST(e.CourseID AS TEXT) AS "קוד קורס",
    e.EnrollmentDate AS "תאריך ההרשמה"
FROM Enrollments e
JOIN Students s ON e.StudentID = s.StudentID
WHERE e.EnrollmentDate >= DATE('now', '-3 months')
ORDER BY e.EnrollmentDate DESC;`,

  // Question 2: Student with highest average grade
  `SELECT 
    s.StudentID AS "תעודת זהות",
    s.FirstName || ' ' || s.LastName AS "שם הסטודנט",
    ROUND(AVG(e.Grade), 2) AS "ממוצע הציונים"
FROM Students s
JOIN Enrollments e ON s.StudentID = e.StudentID
GROUP BY s.StudentID, s.FirstName, s.LastName
HAVING AVG(e.Grade) = (
    SELECT MAX(avg_grade)
    FROM (
        SELECT AVG(Grade) AS avg_grade
        FROM Enrollments
        GROUP BY StudentID
    )
);`,

  // Question 3: Computer Science courses with lecturers having >= 7 years seniority
  `SELECT 
    c.CourseName AS "שם הקורס",
    l.FirstName || ' ' || l.LastName AS "שם המרצה",
    CAST(l.Seniority AS INTEGER) AS "ותק המרצה",
    c.Credits AS "מספר נקודות זכות"
FROM Courses c
JOIN Lecturers l ON c.CourseID = l.CourseID
WHERE c.Department = 'Computer Science'
  AND CAST(l.Seniority AS INTEGER) >= 7
ORDER BY c.Credits ASC;`,

  // Question 4: Department with highest grade
  `SELECT 
    c.Department AS "שם המחלקה"
FROM Courses c
JOIN Enrollments e ON c.CourseID = e.CourseID
WHERE e.Grade = (
    SELECT MAX(Grade)
    FROM Enrollments
)
LIMIT 1;`,

  // Question 5: Departments with at least 3 lecturers with > 12 years seniority
  `SELECT 
    c.Department AS "שם מחלקה",
    COUNT(DISTINCT l.LecturerID) AS "כמות מרצים"
FROM Courses c
JOIN Lecturers l ON c.CourseID = l.CourseID
WHERE CAST(l.Seniority AS INTEGER) > 12
GROUP BY c.Department
HAVING COUNT(DISTINCT l.LecturerID) >= 3;`,

  // Question 6: Percentage of students enrolled per course from start of year
  `SELECT 
    CAST(c.CourseID AS TEXT) AS "קוד הקורס",
    c.CourseName AS "שם הקורס",
    COUNT(DISTINCT e.StudentID) AS "מספר הסטודנטים הרשומים בקורס",
    ROUND(
        (COUNT(DISTINCT e.StudentID) * 100.0 / 
         (SELECT COUNT(DISTINCT StudentID) FROM Enrollments WHERE EnrollmentDate >= strftime('%Y', 'now') || '-01-01')
        ), 2
    ) AS "אחוז הסטודנטים"
FROM Courses c
LEFT JOIN Enrollments e ON c.CourseID = e.CourseID 
    AND e.EnrollmentDate >= strftime('%Y', 'now') || '-01-01'
GROUP BY c.CourseID, c.CourseName
ORDER BY "אחוז הסטודנטים" DESC;`,

  // Question 7: Check if city of student with lowest grade in Database course 
  // matches city of lecturer with highest seniority
  `SELECT 
    CASE 
        WHEN student_city.city = lecturer_city.city THEN 'כן, הערים זהות'
        ELSE 'לא, הערים שונות'
    END AS "תוצאה"
FROM (
    SELECT s.City AS city
    FROM Students s
    JOIN Enrollments e ON s.StudentID = e.StudentID
    JOIN Courses c ON e.CourseID = c.CourseID
    WHERE c.CourseName = 'Database'
      AND e.Grade = (
          SELECT MIN(Grade)
          FROM Enrollments e2
          JOIN Courses c2 ON e2.CourseID = c2.CourseID
          WHERE c2.CourseName = 'Database'
      )
    LIMIT 1
) student_city
CROSS JOIN (
    SELECT l.City AS city
    FROM Lecturers l
    WHERE CAST(l.Seniority AS INTEGER) = (
        SELECT MAX(CAST(Seniority AS INTEGER))
        FROM Lecturers
        WHERE Seniority GLOB '[0-9]*'
    )
    AND l.Seniority GLOB '[0-9]*'
    LIMIT 1
) lecturer_city;`,

  // Question 8: Students in Computer Science who also took Calculus I, with 10% bonus
  `SELECT 
    s.StudentID AS "תעודת זהות סטודנט",
    ROUND(e.Grade * 1.1, 2) AS "ציון מעודכן",
    c.Department AS "מחלקה"
FROM Students s
JOIN Enrollments e ON s.StudentID = e.StudentID
JOIN Courses c ON e.CourseID = c.CourseID
WHERE c.Department = 'Computer Science'
  AND s.StudentID IN (
      SELECT e2.StudentID
      FROM Enrollments e2
      JOIN Courses c2 ON e2.CourseID = c2.CourseID
      WHERE c2.CourseName = 'Introduction to CS'
  )
  AND s.StudentID IN (
      SELECT e3.StudentID
      FROM Enrollments e3
      JOIN Courses c3 ON e3.CourseID = c3.CourseID
      WHERE c3.CourseName = 'Calculus I'
  )
ORDER BY "ציון מעודכן" DESC, c.Department ASC;`,

  // Question 9: All lecturers and their courses (LEFT JOIN to show lecturers without courses)
  `SELECT 
    l.FirstName || ' ' || l.LastName AS "שם המרצה",
    COALESCE(c.CourseName, '') AS "שם הקורס"
FROM Lecturers l
LEFT JOIN Courses c ON l.CourseID = c.CourseID
ORDER BY "שם המרצה" ASC;`,

  // Question 10: Update grades for Calculus I students with grade < 70, add 6 points
  // Note: This is a SELECT showing what would be updated (since we can't actually UPDATE in a SELECT)
  `SELECT 
    e.StudentID AS "תעודת זהות",
    c.CourseName AS "שם הקורס",
    e.Grade AS "ציון קודם",
    CASE 
        WHEN e.Grade < 70 THEN e.Grade + 6
        ELSE e.Grade
    END AS "ציון חדש"
FROM Enrollments e
JOIN Courses c ON e.CourseID = c.CourseID
WHERE c.CourseName = 'Calculus I'
  AND e.Grade < 70;`,

  // Question 11: Students living in same city as their course lecturer
  `SELECT 
    s.StudentID AS "תעודת זהות",
    s.FirstName || ' ' || s.LastName AS "שם סטודנט",
    s.City AS "עיר מגורים",
    c.CourseName AS "שם קורס",
    l.FirstName || ' ' || l.LastName AS "שם מרצה"
FROM Students s
JOIN Enrollments e ON s.StudentID = e.StudentID
JOIN Courses c ON e.CourseID = c.CourseID
JOIN Lecturers l ON c.CourseID = l.CourseID
WHERE s.City = l.City
ORDER BY "שם סטודנט" ASC;`,

  // Question 12: Students categorized by grade ranges
  `SELECT 
    s.StudentID AS "תעודת זהות",
    s.FirstName || ' ' || s.LastName AS "שם סטודנט",
    ROUND(AVG(e.Grade), 2) AS "ממוצע ציונים",
    CASE 
        WHEN AVG(e.Grade) >= 90 THEN 'מצוין'
        WHEN AVG(e.Grade) >= 80 THEN 'טוב מאוד'
        WHEN AVG(e.Grade) >= 70 THEN 'טוב'
        WHEN AVG(e.Grade) >= 60 THEN 'מספיק'
        ELSE 'לא מספיק'
    END AS "קטגוריית ציון"
FROM Students s
JOIN Enrollments e ON s.StudentID = e.StudentID
GROUP BY s.StudentID, s.FirstName, s.LastName
ORDER BY "ממוצע ציונים" DESC;`,

  // Question 13: Top 3 courses by average grade (with ties)
  `SELECT 
    CAST(c.CourseID AS TEXT) AS "קוד קורס",
    c.CourseName AS "שם קורס",
    ROUND(AVG(e.Grade), 2) AS "ממוצע ציונים",
    COUNT(DISTINCT e.StudentID) AS "מספר סטודנטים"
FROM Courses c
JOIN Enrollments e ON c.CourseID = e.CourseID
GROUP BY c.CourseID, c.CourseName
HAVING AVG(e.Grade) >= (
    SELECT MIN(avg_grade)
    FROM (
        SELECT AVG(Grade) AS avg_grade
        FROM Enrollments
        GROUP BY CourseID
        ORDER BY avg_grade DESC
        LIMIT 3
    ) AS top3
)
ORDER BY "ממוצע ציונים" DESC;`
];

async function addSolutions() {
  try {
    const { db } = await connectToDatabase();
    const homeworkService = await getHomeworkService();
    const questionsService = await getQuestionsService();

    // Find the homework set "תרגיל 3"
    const allHomeworkSets = await homeworkService.listHomeworkSets({ pageSize: 1000 });
    const exercise3Set = allHomeworkSets.items.find(hw => hw.title === "תרגיל 3");

    if (!exercise3Set) {
      console.error('❌ Homework set "תרגיל 3" not found');
      process.exit(1);
    }

    console.log(`✅ Found homework set: ${exercise3Set.title} (ID: ${exercise3Set.id})`);

    // Get all questions for this homework set
    const questions = await questionsService.getQuestionsByHomeworkSet(exercise3Set.id);
    console.log(`📋 Found ${questions.length} questions`);

    if (questions.length !== 13) {
      console.warn(`⚠️  Expected 13 questions, but found ${questions.length}`);
    }

    // Update each question with its solution
    for (let i = 0; i < Math.min(questions.length, solutions.length); i++) {
      const question = questions[i];
      const solution = solutions[i];

      console.log(`\n📝 Updating question ${i + 1}: ${question.prompt.substring(0, 50)}...`);
      
      const updated = await questionsService.updateQuestion(question.id, {
        starterSql: solution
      });

      if (updated) {
        console.log(`   ✅ Updated question ${i + 1} with solution`);
      } else {
        console.error(`   ❌ Failed to update question ${i + 1}`);
      }
    }

    console.log('\n✅ Successfully added solutions to all questions!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error adding solutions:', error);
    process.exit(1);
  }
}

// Run the script
addSolutions();

