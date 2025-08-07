console.log('🧪 Testing backend API fix for קרן ריזנברג...\n');

async function testBackendFix() {
  const examId = '6878a7e32c796f9cd66e406c';
  const SERVER_BASE = 'https://mentor-server-theta.vercel.app';
  
  try {
    console.log('🔄 Testing for-grading API after fix...');
    
    const response = await fetch(`${SERVER_BASE}/admin/final-exam/${examId}/for-grading`);
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('✅ API Response received!');
      console.log(`📊 Answers: ${data.answers?.length || 0}`);
      console.log(`📊 MergedAnswers: ${data.mergedAnswers?.length || 0}`);
      console.log(`📊 ExistingGrades: ${data.existingGrades?.length || 0}`);
      
      if (data.answers && data.answers.length > 0) {
        console.log('\n✅ SUCCESS! Backend is now returning answer data');
        console.log('🎯 First few answers:');
        data.answers.slice(0, 3).forEach((answer, index) => {
          console.log(`   ${index + 1}. questionIndex: ${answer.questionIndex}`);
          console.log(`      Question: "${(answer.questionText || '').substring(0, 60)}..."`);
        });
      } else {
        console.log('\n❌ Still no answers returned');
      }
      
      if (data.existingGrades && data.existingGrades.length > 0) {
        console.log('\n✅ Existing grades found:');
        data.existingGrades.forEach(grade => {
          const isProblematic = grade.maxScore === 1 && grade.score > 1;
          console.log(`   questionIndex ${grade.questionIndex}: ${grade.score}/${grade.maxScore} ${isProblematic ? '(WILL BE FILTERED)' : ''}`);
        });
      }
      
    } else {
      console.log(`❌ API call failed: ${response.status}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error.message);
  }
}

// Give the servers time to start
setTimeout(() => {
  console.log('⏰ Waiting for servers to start...\n');
  testBackendFix();
}, 5000);