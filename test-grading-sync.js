/**
 * Grade Sync Testing and Validation Script
 * 
 * This script helps test and validate the grading synchronization fixes
 * Run this from the sql-chatbot directory: node test-grading-sync.js
 */

const config = {
  // Update this to match your mentor-server URL
  serverUrl: 'http://localhost:3001', // or your actual mentor-server URL
  
  // Frontend URL for API testing
  frontendUrl: 'http://localhost:3000',
  
  // Test exam ID - replace with a real exam ID from your system
  testExamId: null, // Will be set when running tests
  
  // Test question index
  testQuestionIndex: 0,
  
  // Test grade values
  testGrade: 2.5,
  testFeedback: 'Test feedback for sync validation (BACKEND FIX)'
};

async function testGradeSync() {
  console.log('🧪 Starting Grade Synchronization Tests...\n');
  
  try {
    // Test 1: Get all exam sessions to find a test exam
    console.log('📋 Test 1: Finding available exams...');
    const sessionsResponse = await fetch(`${config.serverUrl}/admin/exam-sessions`);
    
    if (!sessionsResponse.ok) {
      throw new Error('Failed to fetch exam sessions');
    }
    
    const sessions = await sessionsResponse.json();
    const completedExams = sessions.filter(session => session.status === 'completed');
    
    if (completedExams.length === 0) {
      console.log('❌ No completed exams found for testing');
      return;
    }
    
    config.testExamId = completedExams[0]._id;
    console.log(`✅ Found test exam: ${config.testExamId}`);
    console.log(`   Student: ${completedExams[0].studentName || 'Unknown'}`);
    console.log(`   Date: ${completedExams[0].startTime}\n`);
    
    // Test 2: Test grade-by-questions backend endpoint (grade-answer)
    console.log('📋 Test 2: Testing grade-by-questions backend sync...');
    const gradeAnswerResponse = await fetch(`${config.serverUrl}/api/admin/grade-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        examId: config.testExamId,
        questionIndex: config.testQuestionIndex,
        grade: config.testGrade,
        feedback: config.testFeedback
      })
    });
    
    if (gradeAnswerResponse.ok) {
      const gradeResult = await gradeAnswerResponse.json();
      console.log('✅ Grade-by-questions backend working');
      console.log(`   Result: ${gradeResult.success ? 'Success' : 'Failed'}\n`);
    } else {
      console.log(`❌ Grade-by-questions backend failed: ${gradeAnswerResponse.status}`);
      const error = await gradeAnswerResponse.text();
      console.log(`   Error: ${error}\n`);
    }
    
    // Test 3: Test individual exam save endpoint
    console.log('📋 Test 3: Testing individual exam save sync...');
    const examSaveResponse = await fetch(`${config.serverUrl}/admin/final-exam/${config.testExamId}/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        partialSave: true,
        questionGrades: [{
          questionIndex: config.testQuestionIndex,
          score: config.testGrade + 0.5, // Slightly different to test
          maxScore: 3,
          feedback: config.testFeedback + ' (individual save)'
        }],
        totalScore: config.testGrade + 0.5,
        maxScore: 3,
        overallFeedback: 'Test overall feedback'
      })
    });
    
    if (examSaveResponse.ok) {
      const examResult = await examSaveResponse.json();
      console.log('✅ Individual exam save working');
      console.log(`   Result: ${examResult.success ? 'Success' : 'Failed'}\n`);
    } else {
      console.log(`❌ Individual exam save failed: ${examSaveResponse.status}`);
      const error = await examSaveResponse.text();
      console.log(`   Error: ${error}\n`);
    }
    
    // Test 4: Validate data consistency
    console.log('📋 Test 4: Checking data consistency...');
    
    // Check finalExams.review
    const examDataResponse = await fetch(`${config.serverUrl}/admin/final-exam/${config.testExamId}/for-grading`);
    let finalExamData = null;
    if (examDataResponse.ok) {
      finalExamData = await examDataResponse.json();
      const questionGradesCount = finalExamData.review?.questionGrades?.length || 0;
      const totalScore = finalExamData.review?.totalScore || 0;
      console.log(`✅ FinalExams.review: ${questionGradesCount} question grades, total: ${totalScore}`);
    } else {
      console.log('❌ Failed to fetch finalExams.review data');
    }
    
    // Check examGrades collection
    const gradeResponse = await fetch(`${config.serverUrl}/admin/final-exam/${config.testExamId}/grade`);
    if (gradeResponse.ok) {
      const gradeData = await gradeResponse.json();
      const totalScore = gradeData.totalScore || 0;
      console.log(`✅ ExamGrades collection: total score ${totalScore}`);
      
      // Compare the two sources
      if (finalExamData?.review?.totalScore === gradeData.totalScore) {
        console.log('✅ Data sources are SYNCHRONIZED');
      } else {
        console.log('⚠️  Data sources are NOT synchronized');
        console.log(`   FinalExams.review.totalScore: ${finalExamData?.review?.totalScore}`);
        console.log(`   ExamGrades.totalScore: ${gradeData.totalScore}`);
      }
    } else {
      console.log('❌ Failed to fetch examGrades data');
    }
    console.log();
    
    // Test 5: Test the validation API
    console.log('📋 Test 5: Testing validation API...');
    const validationResponse = await fetch(`http://localhost:3000/api/admin/unified-grade-sync?examId=${config.testExamId}&action=validate_grades`);
    
    if (validationResponse.ok) {
      const validationResult = await validationResponse.json();
      console.log('✅ Validation API working');
      console.log(`   Consistent: ${validationResult.isConsistent}`);
      if (validationResult.differences?.length > 0) {
        console.log(`   Differences found:`, validationResult.differences);
      }
    } else {
      console.log(`❌ Validation API failed: ${validationResponse.status}`);
    }
    console.log();
    
    // Test 6: Test bulk export with fresh data
    console.log('📋 Test 6: Testing bulk export with fresh data...');
    const exportResponse = await fetch('http://localhost:3000/api/admin/bulk-export/grades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        examSessions: [completedExams[0]] // Just test with one exam
      })
    });
    
    if (exportResponse.ok) {
      const csvContent = await exportResponse.text();
      const lines = csvContent.split('\n');
      console.log('✅ Bulk export working');
      console.log(`   CSV header: ${lines[0]}`);
      console.log(`   First data row: ${lines[1]}`);
      console.log(`   Includes grade source: ${lines[0].includes('מקור הציון') ? 'Yes' : 'No'}`);
    } else {
      console.log(`❌ Bulk export failed: ${exportResponse.status}`);
    }
    console.log();
    
    console.log('🎉 Grade synchronization tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Instructions for manual testing
function printManualTestingInstructions() {
  console.log('\n📝 Manual Testing Instructions:');
  console.log('=====================================');
  console.log('1. Grade some questions in "grade-by-questions" interface');
  console.log('2. Go to "exam-grading" interface and check if grades appear correctly');
  console.log('3. Click "🔄 רענן וסנכרן ציונים" button to sync grades');
  console.log('4. Export grades and check if the CSV matches the interface');
  console.log('5. Check individual exam pages to see if grades are loaded correctly');
  console.log('6. Look for console logs that show grade sources (finalExams.review.questionGrades, etc.)');
  console.log('\n🔍 Key things to verify:');
  console.log('- Grade-by-questions saves → immediately visible in exam-grading');
  console.log('- Exported CSV grades match what you see in the interface');
  console.log('- Individual exam pages show the correct grades and feedback');
  console.log('- No "initialized to zero" issues when opening individual exams');
  console.log('\n💡 Debug tips:');
  console.log('- Open browser console (F12) to see grade loading logs');
  console.log('- Check the "מקור הציון" column in exported CSV for data sources');
  console.log('- Use "🔍 בדוק סנכרון ציונים" button to validate all grades');
}

// Main execution
if (require.main === module) {
  console.log('🔧 Grade Synchronization Fix - Test Suite');
  console.log('==========================================\n');
  
  // Check if server URLs are configured
  if (!config.serverUrl.includes('localhost') && !config.serverUrl.includes('your-server')) {
    console.log('⚠️  Please update the serverUrl in this script to match your mentor-server URL\n');
  }
  
  // Run automated tests
  testGradeSync().then(() => {
    printManualTestingInstructions();
  });
}

module.exports = {
  testGradeSync,
  config
};