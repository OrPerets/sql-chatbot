console.log('🔍 Real-time browser debugging for קרן ריזנברג...\n');

async function debugRealtimeBrowser() {
  const examId = '6878a7e32c796f9cd66e406c';
  
  try {
    // Test the local development server
    console.log('🌐 Testing local development server...');
    
    const localResponse = await fetch(`http://localhost:3000/admin/exam-grading/${examId}`);
    if (localResponse.ok) {
      console.log('✅ Frontend server is running');
    } else {
      console.log(`❌ Frontend server issue: ${localResponse.status}`);
    }
    
    // Test the backend API directly from local
    console.log('\n🔄 Testing backend API from local frontend...');
    
    const backendResponse = await fetch('https://mentor-server-theta.vercel.app/admin/final-exam/' + examId + '/for-grading');
    if (backendResponse.ok) {
      const data = await backendResponse.json();
      console.log('✅ Backend API working:');
      console.log(`   📊 Answers: ${data.answers?.length || 0}`);
      console.log(`   📊 ExistingGrades: ${data.existingGrades?.length || 0}`);
      
      if (data.answers && data.answers.length > 0) {
        console.log('\n📝 Sample answers:');
        data.answers.slice(0, 2).forEach((answer, index) => {
          console.log(`   ${index + 1}. questionIndex: ${answer.questionIndex}`);
          console.log(`      Question: "${(answer.questionText || '').substring(0, 50)}..."`);
        });
      }
      
      if (data.existingGrades && data.existingGrades.length > 0) {
        console.log('\n💾 Existing grades:');
        data.existingGrades.forEach(grade => {
          console.log(`   questionIndex ${grade.questionIndex}: ${grade.score}/${grade.maxScore}`);
        });
      } else {
        console.log('\n❌ No existing grades found - this might be the issue!');
      }
    } else {
      console.log(`❌ Backend API failed: ${backendResponse.status}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\n💡 Next steps for debugging:');
  console.log('1. 🔄 Hard refresh the browser page (Ctrl+Shift+R)');
  console.log('2. 📱 Open Developer Tools (F12)');
  console.log('3. 👀 Check Console tab for filtering logs');
  console.log('4. 🔍 Look for these specific messages:');
  console.log('   "📊 API Response Debug"');
  console.log('   "⚠️ Filtering out problematic question"');
  console.log('   "✅ Prioritizing questionIndex"');
  console.log('\n5. 📸 If still seeing 1/1 scores, send me the console logs!');
}

debugRealtimeBrowser();