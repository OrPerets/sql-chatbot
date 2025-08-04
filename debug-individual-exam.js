/**
 * Debug Individual Exam Page Data Loading
 * 
 * This script tests the complete flow from grade-by-questions to individual exam page
 * Run this from sql-chatbot directory: node debug-individual-exam.js
 */

const config = {
  mentorServerUrl: 'http://localhost:5555',
  frontendUrl: 'http://localhost:3000'
};

async function debugIndividualExamFlow() {
  console.log('🔍 Debug: Individual Exam Page Data Loading\n');
  
  try {
    // Step 1: Get a test exam
    console.log('📋 Step 1: Finding a test exam...');
    const sessionsResponse = await fetch(`${config.mentorServerUrl}/admin/exam-sessions`);
    
    if (!sessionsResponse.ok) {
      throw new Error('Failed to fetch exam sessions');
    }
    
    const sessions = await sessionsResponse.json();
    const completedExams = sessions.filter(session => session.status === 'completed');
    
    if (completedExams.length === 0) {
      console.log('❌ No completed exams found for testing');
      return;
    }
    
    const testExam = completedExams[0];
    const examId = testExam._id;
    
    console.log(`✅ Using test exam: ${examId}`);
    console.log(`   Student: ${testExam.studentName || 'Unknown'}`);
    console.log(`   Date: ${testExam.startTime}\n`);
    
    // Step 2: Grade a question using grade-by-questions endpoint
    console.log('📋 Step 2: Grading a question via grade-by-questions endpoint...');
    const gradeAnswerResponse = await fetch(`${config.mentorServerUrl}/api/admin/grade-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        examId: examId,
        questionIndex: 0,
        grade: 2.5,
        feedback: 'Test feedback from debug script'
      })
    });
    
    if (gradeAnswerResponse.ok) {
      const gradeResult = await gradeAnswerResponse.json();
      console.log('✅ Successfully graded via grade-by-questions');
      console.log(`   Result: ${gradeResult.success ? 'Success' : 'Failed'}\n`);
    } else {
      console.log(`❌ Grade-by-questions failed: ${gradeAnswerResponse.status}\n`);
    }
    
    // Step 3: Check what's stored in finalExams.review
    console.log('📋 Step 3: Checking finalExams.review data...');
    const examDataResponse = await fetch(`${config.mentorServerUrl}/admin/final-exam/${examId}/for-grading`);
    
    let examData = null;
    let isFinalExam = false;
    
    if (examDataResponse.ok) {
      examData = await examDataResponse.json();
      isFinalExam = !!examData.mergedAnswers;
      
      console.log('✅ Raw exam data structure:');
      console.log(`   Has mergedAnswers: ${!!examData.mergedAnswers} (${examData.mergedAnswers?.length || 0} answers)`);
      console.log(`   Has answers: ${!!examData.answers} (${examData.answers?.length || 0} answers)`);
      console.log(`   Has review: ${!!examData.review}`);
      
      if (examData.review) {
        console.log(`   Review.questionGrades: ${examData.review.questionGrades?.length || 0} grades`);
        console.log(`   Review.totalScore: ${examData.review.totalScore || 0}`);
        
        if (examData.review.questionGrades?.length > 0) {
          console.log('   📊 First question grade:', examData.review.questionGrades[0]);
        }
      }
      console.log();
    } else {
      console.log('❌ Failed to fetch exam data from final-exam endpoint, trying regular exam...');
      
      // Try regular exam endpoint
      const regularExamResponse = await fetch(`${config.mentorServerUrl}/admin/exam/${examId}/for-grading`);
      if (regularExamResponse.ok) {
        examData = await regularExamResponse.json();
        isFinalExam = false;
        console.log('✅ Found exam in regular exam collection');
        console.log(`   Has answers: ${!!examData.answers} (${examData.answers?.length || 0} answers)`);
        console.log();
      } else {
        console.log('❌ Failed to fetch exam data from both endpoints\n');
      }
    }
    
    // Step 4: Check what the grade endpoint returns
    console.log('📋 Step 4: Checking grade endpoint data (what individual exam page loads)...');
    
    const endpointType = isFinalExam ? 'final-exam' : 'exam';
    console.log(`📊 Using ${endpointType} endpoint for this exam type`);
    
    const gradeResponse = await fetch(`${config.mentorServerUrl}/admin/${endpointType}/${examId}/grade`);
    
    if (gradeResponse.ok) {
      const gradeData = await gradeResponse.json();
      
      console.log('✅ Grade endpoint response:');
      console.log('   Raw response:', gradeData);
      
      if (gradeData) {
        console.log(`   Data source: ${gradeData.dataSource}`);
        console.log(`   Question grades count: ${gradeData.questionGrades?.length || 0}`);
        console.log(`   Total score: ${gradeData.totalScore}`);
        console.log(`   Overall feedback: "${gradeData.overallFeedback}"`);
        
        if (gradeData.questionGrades?.length > 0) {
          console.log('   📊 First question grade from endpoint:', gradeData.questionGrades[0]);
        }
      } else {
        console.log('   ⚠️ Grade endpoint returned null');
      }
      console.log();
    } else {
      console.log(`❌ Failed to fetch grade data from grade endpoint: ${gradeResponse.status}`);
      const errorText = await gradeResponse.text();
      console.log(`   Error: ${errorText}\n`);
    }
    
    // Step 5: Simulate how the frontend processes this data
    console.log('📋 Step 5: Simulating frontend data processing...');
    
    // Fetch both exam data and grade data (like the frontend does)
    const [examRes, gradeRes] = await Promise.all([
      fetch(`${config.mentorServerUrl}/admin/final-exam/${examId}/for-grading`),
      fetch(`${config.mentorServerUrl}/admin/final-exam/${examId}/grade`)
    ]);
    
    if (examRes.ok && gradeRes.ok) {
      const examData = await examRes.json();
      const gradeData = await gradeRes.json();
      
      // Attach existing grades to exam data (like frontend does)
      if (gradeData.questionGrades && Array.isArray(gradeData.questionGrades)) {
        examData.existingGrades = gradeData.questionGrades;
        console.log('✅ Attached existing grades to exam data');
        console.log(`   Attached ${gradeData.questionGrades.length} grades`);
      } else {
        console.log('⚠️  No question grades to attach');
      }
      
      // Get unique answers (like frontend does)
      const answersSource = examData.mergedAnswers || examData.answers;
      console.log(`   Using ${examData.mergedAnswers ? 'mergedAnswers' : 'answers'} as source (${answersSource?.length || 0} answers)`);
      
      // Check if grades can be mapped properly
      if (examData.existingGrades && answersSource) {
        let mappedCount = 0;
        examData.existingGrades.forEach((grade) => {
          const matchingAnswer = answersSource.find(answer => answer.questionIndex === grade.questionIndex);
          if (matchingAnswer) {
            mappedCount++;
            console.log(`   ✅ Can map grade for question ${grade.questionIndex}: score=${grade.score}, feedback="${grade.feedback?.substring(0, 30)}..."`);
          } else {
            console.log(`   ❌ Cannot map grade for question ${grade.questionIndex} - no matching answer found`);
          }
        });
        
        console.log(`   📊 Successfully mapped ${mappedCount} out of ${examData.existingGrades.length} grades`);
      }
      
    } else {
      console.log('❌ Failed to fetch data for frontend simulation');
    }
    
    console.log('\n🎉 Debug analysis complete!');
    console.log('\n💡 Next steps:');
    console.log('1. Check mentor-server console for the logs when individual exam page loads');
    console.log('2. Check browser console for the frontend logs when opening individual exam');
    console.log('3. Verify that grades are being mapped correctly from questionIndex');
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

// Instructions for manual testing
function printDebugInstructions() {
  console.log('\n📝 Manual Debugging Steps:');
  console.log('==============================');
  console.log('1. Make sure mentor-server is running (node api/index.js)');
  console.log('2. Grade some questions in "grade-by-questions" interface');
  console.log('3. Go to "exam-grading" and click on a student exam');
  console.log('4. Open browser console (F12) and look for:');
  console.log('   - "🔍 GET final exam grade data for: [examId]" in mentor-server console');
  console.log('   - "✅ Successfully loaded grade data:" in browser console');
  console.log('   - "🔄 Initializing grades for exam:" in browser console');
  console.log('   - "📊 Mapped grade for question X:" messages');
  console.log('\n🔍 Key things to check:');
  console.log('- Does gradeData.dataSource show "finalExams.review"?');
  console.log('- Do questionGrades have the correct questionIndex values?');
  console.log('- Are grades being mapped to the correct questions?');
  console.log('- Is the frontend using mergedAnswers or answers array?');
}

// Main execution
if (require.main === module) {
  console.log('🔧 Individual Exam Page - Debug Script');
  console.log('======================================\n');
  
  debugIndividualExamFlow().then(() => {
    printDebugInstructions();
  });
}

module.exports = { debugIndividualExamFlow };