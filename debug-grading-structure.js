// Debug script to understand examGrades structure
const config = {
  serverUrl: 'https://mentor-server-theta.vercel.app'
};

async function debugGradingStructure() {
  try {
    console.log('🔍 Debugging examGrades collection structure...\n');
    
    // Check the structure of examGrades collection
    const response = await fetch(`${config.serverUrl}/api/admin/debug/exam-grades-structure`);
    
    if (!response.ok) {
      console.log('⚠️ Debug endpoint not available, creating a basic check...');
      
      // Let's test with a specific question to see what's happening
      console.log('🧪 Testing specific question grading data...');
      
      const testResponse = await fetch(`${config.serverUrl}/api/admin/questions-optimized?questionId=1&includeGradingStatus=true`);
      const testData = await testResponse.json();
      
      if (testData.questions && testData.questions.length > 0) {
        const q = testData.questions[0];
        console.log(`📊 Question #1 detailed data:`);
        console.log(`  - answerCount: ${q.answerCount}`);
        console.log(`  - gradedCount: ${q.gradedCount}`);
        console.log(`  - ungradedCount: ${q.ungradedCount}`);
        console.log(`  - completionPercentage: ${q.completionPercentage}`);
        console.log(`  - isCompleted: ${q.isCompleted}`);
        
        if (q.gradedCount === q.answerCount && q.completionPercentage === 0) {
          console.log('❌ ISSUE: All answers graded but completion is 0% - grading detection problem');
        }
        
        if (q.gradedCount > 0 && q.completionPercentage === 0) {
          console.log('❌ ISSUE: Graded answers exist but completion calculation is wrong');
        }
      }
      
    } else {
      const debugData = await response.json();
      console.log('📊 ExamGrades structure:', JSON.stringify(debugData, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugGradingStructure();
