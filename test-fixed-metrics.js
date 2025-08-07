// Test script to verify fixed grading metrics
const config = {
  serverUrl: 'https://mentor-server-theta.vercel.app'
};

async function testFixedMetrics() {
  try {
    console.log('🧪 Testing fixed grading metrics...\n');
    
    // Test מועד ב - should now use examSessions and examGrades
    console.log('📊 Testing מועד ב (Questions Collection) - should use examSessions/examGrades:');
    const moedBResponse = await fetch(`${config.serverUrl}/api/admin/questions-optimized?page=1&limit=5&includeGradingStatus=true`);
    const moedBData = await moedBResponse.json();
    
    console.log(`✅ Found ${moedBData.questions.length} questions`);
    
    moedBData.questions.forEach((q, index) => {
      console.log(`  ${index + 1}. שאלה #${q.id}: ${q.answerCount} תשובות, ${q.gradedCount || 0} מציונות, ${q.completionPercentage || 0}% הושלם`);
      
      if (q.answerCount > 0 && q.completionPercentage === 100 && q.gradedCount === 0) {
        console.log(`    ⚠️  Warning: Question ${q.id} shows 100% complete but 0 graded - this might indicate old bug`);
      }
      
      if (q.gradedCount > q.answerCount) {
        console.log(`    ❌ Error: Question ${q.id} has more grades (${q.gradedCount}) than answers (${q.answerCount})`);
      }
      
      if (q.answerCount === 0 && q.completionPercentage === 0) {
        console.log(`    ✅ Good: Question ${q.id} shows 0 answers and 0% completion (correct for future exam)`);
      }
    });
    
    console.log('\n📊 Testing מועד א (FinalExams Collection) - should use finalExams:');
    const moedAResponse = await fetch(`${config.serverUrl}/api/admin/questions-with-answers?page=1&limit=5&includeGradingStatus=true`);
    const moedAData = await moedAResponse.json();
    
    console.log(`✅ Found ${moedAData.questions.length} questions`);
    
    moedAData.questions.forEach((q, index) => {
      console.log(`  ${index + 1}. שאלה #${q.id}: ${q.answerCount} תשובות, ${q.gradedCount || 0} מציונות, ${q.completionPercentage || 0}% הושלם`);
    });
    
    console.log('\n🎯 Summary:');
    console.log('- מועד ב should show minimal or no answers (exam hasn\'t happened yet)');
    console.log('- מועד א should show actual FinalExams data');
    console.log('- Completion percentage should be based on actual grading progress');
    console.log('- No question should show completed without any graded answers');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testFixedMetrics();
