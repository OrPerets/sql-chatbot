console.log('🧪 Testing deployed server for grades...\n');

async function testDeployedServer() {
  const examId = '6878a7e32c796f9cd66e406c';
  const SERVER_BASE = 'https://mentor-server-theta.vercel.app';
  
  try {
    console.log('🔄 Testing deployed backend API...');
    
    const response = await fetch(`${SERVER_BASE}/admin/final-exam/${examId}/for-grading`);
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('✅ API Response from deployed server:');
      console.log(`📊 Answers: ${data.answers?.length || 0}`);
      console.log(`📊 ExistingGrades: ${data.existingGrades?.length || 0}`);
      
      if (data.existingGrades && data.existingGrades.length > 0) {
        console.log('\n🎉 SUCCESS! Grades are now being returned from deployed server!');
        console.log('📋 Found grades:');
        data.existingGrades.forEach(grade => {
          const isProblematic = grade.maxScore === 1 && grade.score > 1;
          const status = isProblematic ? '🚨 PROBLEMATIC - WILL BE FILTERED' : '✅ OK';
          console.log(`   questionIndex ${grade.questionIndex}: ${grade.score}/${grade.maxScore} ${status}`);
        });
        
        const problematicCount = data.existingGrades.filter(g => g.maxScore === 1 && g.score > 1).length;
        console.log(`\n📊 Summary: ${problematicCount} problematic grades will be filtered out by frontend`);
        console.log('🎯 The frontend filtering should now work properly!');
        
      } else {
        console.log('\n❌ Still no grades returned from deployed server');
        console.log('💡 The deployment might not have included the grade loading fix');
      }
      
    } else {
      console.log(`❌ API call failed: ${response.status}`);
      const errorText = await response.text();
      console.log('Error details:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Error testing deployed server:', error.message);
  }
  
  console.log('\n🎯 If grades are now returned:');
  console.log('1. 🔄 Hard refresh the browser (Ctrl+Shift+R)');
  console.log('2. 📱 Open Developer Tools (F12)');
  console.log('3. 👀 Check console for filtering messages like:');
  console.log('   "⚠️ Filtering out problematic question"');
  console.log('4. ✅ Should see normal questions instead of 4/1, 6/1 scores');
}

testDeployedServer();