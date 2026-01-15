/**
 * Test script to verify DATEDIFF and CURDATE() fixes
 * Run with: npx tsx scripts/test-datediff-fix.ts
 */

import { connectToDatabase } from '../lib/database';
import { getSubmissionsService } from '../lib/submissions';
import { ObjectId } from 'mongodb';

async function testDatediffFix() {
  try {
    console.log('🧪 Testing DATEDIFF and CURDATE() fixes...\n');
    
    const { db } = await connectToDatabase();
    const submissionsService = await getSubmissionsService();
    
    // Find a homework set for Exercise 3
    const homeworkSets = await db.collection('homework_sets').find({}).limit(5).toArray();
    const exercise3Set = homeworkSets.find(hw => 
      hw.title?.includes('תרגיל 3') || 
      hw.title?.includes('תרגיל בית 3') ||
      hw.name?.includes('תרגיל 3')
    );
    
    if (!exercise3Set) {
      console.error('❌ Could not find Exercise 3 homework set');
      console.log('Available sets:', homeworkSets.map(h => h.title || h.name));
      process.exit(1);
    }
    
    console.log(`✅ Found homework set: ${exercise3Set.title || exercise3Set.name} (ID: ${exercise3Set.id || exercise3Set._id})`);
    
    // Find a question from this set
    const questions = await db.collection('questions').find({
      homeworkSetId: exercise3Set.id || exercise3Set._id.toString()
    }).limit(1).toArray();
    
    if (questions.length === 0) {
      console.error('❌ Could not find any questions for this homework set');
      process.exit(1);
    }
    
    const question = questions[0];
    console.log(`✅ Found question: ${question.prompt?.substring(0, 60)}... (ID: ${question.id || question._id})`);
    
    // Find a student ID (use any student)
    const students = await db.collection('users').find({ role: 'student' }).limit(1).toArray();
    if (students.length === 0) {
      console.error('❌ Could not find any students');
      process.exit(1);
    }
    
    const studentId = students[0]._id.toString();
    console.log(`✅ Using student ID: ${studentId}\n`);
    
    // Test SQL queries
    const testQueries = [
      {
        name: 'Test 1: DATEDIFF with string dates',
        sql: `SELECT DATEDIFF('2026-01-13', '2026-01-01') AS diff`
      },
      {
        name: 'Test 2: DATEDIFF with CURDATE()',
        sql: `SELECT DATEDIFF(CURDATE(), '2026-01-01') AS diff`
      },
      {
        name: 'Test 3: DATEDIFF with column reference (from Enrollments)',
        sql: `SELECT StudentID, DATEDIFF('2026-01-13', EnrollmentDate) AS daysDiff FROM Enrollments LIMIT 5`
      },
      {
        name: 'Test 4: Full query with DATEDIFF and CURDATE (like student query)',
        sql: `SELECT StudentID, CONCAT(FirstName, ' ', LastName) AS fullName, CourseID, EnrollmentDate FROM Enrollments JOIN Students USING(StudentID) WHERE DATEDIFF(CURDATE(), EnrollmentDate) >= 0 AND DATEDIFF(CURDATE(), EnrollmentDate) <= 77`
      }
    ];
    
    const setId = exercise3Set.id || exercise3Set._id.toString();
    const questionId = question.id || question._id.toString();
    
    for (const test of testQueries) {
      console.log(`\n📝 ${test.name}`);
      console.log(`   SQL: ${test.sql}`);
      
      try {
        const result = await submissionsService.executeSqlForSubmission({
          setId,
          questionId,
          studentId,
          sql: test.sql,
          submissionId: 'test-submission',
          attemptNumber: 1,
          preview: true
        });
        
        if (result) {
          console.log(`   ✅ Success! Rows: ${result.rows.length}, Columns: ${result.columns.join(', ')}`);
          if (result.rows.length > 0) {
            console.log(`   📊 First row:`, result.rows[0]);
          }
          if (result.feedback?.autoNotes) {
            console.log(`   ℹ️  Feedback: ${result.feedback.autoNotes}`);
          }
        } else {
          console.log(`   ❌ Returned null`);
        }
      } catch (error: any) {
        console.log(`   ❌ Error: ${error.message}`);
        if (error.stack) {
          console.log(`   Stack: ${error.stack.split('\n')[1]}`);
        }
      }
    }
    
    console.log('\n✅ Test completed!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testDatediffFix();
