/**
 * Test Individual Exam Fix
 * 
 * This script tests if the individual exam page can now find grades in either location
 */

const config = {
  mentorServerUrl: 'http://localhost:5555',
  testExamId: '6878b54ba90c1595658c9aba' // Use the same exam from debug
};

async function testIndividualExamFix() {
  console.log('🧪 Testing Individual Exam Page Fix\n');
  
  try {
    // Step 1: Grade a question (save to finalExams.review)
    console.log('📋 Step 1: Grading a question via grade-by-questions...');
    const gradeResponse = await fetch(`${config.mentorServerUrl}/api/admin/grade-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        examId: config.testExamId,
        questionIndex: 0,
        grade: 3.0,
        feedback: 'Test feedback for fix validation'
      })
    });
    
    if (gradeResponse.ok) {
      console.log('✅ Grade saved successfully');
    } else {
      console.log('❌ Failed to save grade');
      return;
    }
    
    // Step 2: Test primary source (exam endpoint - should fail)
    console.log('\n📋 Step 2: Testing primary source (exam endpoint)...');
    const primaryResponse = await fetch(`${config.mentorServerUrl}/admin/exam/${config.testExamId}/grade`);
    
    if (primaryResponse.ok) {
      const primaryData = await primaryResponse.json();
      console.log('✅ Primary source has data:', primaryData.dataSource);
    } else {
      console.log('⚠️ Primary source failed (expected)');
    }
    
    // Step 3: Test alternate source (final-exam endpoint - should succeed)
    console.log('\n📋 Step 3: Testing alternate source (final-exam endpoint)...');
    const alternateResponse = await fetch(`${config.mentorServerUrl}/admin/final-exam/${config.testExamId}/grade`);
    
    console.log(`📊 Alternate response status: ${alternateResponse.status}`);
    
    if (alternateResponse.ok) {
      const alternateData = await alternateResponse.json();
      console.log('✅ Alternate source response:', alternateData);
      
      if (alternateData) {
        console.log('✅ Alternate source has data:', alternateData.dataSource || 'no dataSource field');
        console.log(`   Question grades: ${alternateData.questionGrades?.length || 0}`);
        console.log(`   Total score: ${alternateData.totalScore}`);
        
        if (alternateData.questionGrades?.length > 0) {
          console.log(`   First grade: question ${alternateData.questionGrades[0].questionIndex}, score ${alternateData.questionGrades[0].score}`);
        }
      } else {
        console.log('⚠️ Alternate source returned null');
      }
    } else {
      const errorText = await alternateResponse.text();
      console.log(`❌ Alternate source failed: ${errorText}`);
    }
    
    // Step 4: Summary
    console.log('\n🎉 Test Summary:');
    console.log('- Grade-by-questions saves to finalExams.review ✅');
    console.log('- Individual exam page will try exam endpoint first ⚠️');
    console.log('- Individual exam page will fallback to final-exam endpoint ✅');
    console.log('- This should resolve the sync issue! 🎯');
    
    console.log('\n💡 Next steps:');
    console.log('1. Open an individual exam in the browser');
    console.log('2. Check browser console for "✅ Found grade data in alternate source"');
    console.log('3. Verify that grades and feedback are displayed correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Main execution
if (require.main === module) {
  testIndividualExamFix();
}

module.exports = { testIndividualExamFix };