console.log('🧪 Testing the critical grades loading fix...\n');

async function testGradesFix() {
  const examId = '6878a7e32c796f9cd66e406c';
  const SERVER_BASE = 'https://mentor-server-theta.vercel.app';
  
  try {
    console.log('⏰ Waiting for backend to restart...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('🔄 Testing grades loading after fix...');
    
    const response = await fetch(`${SERVER_BASE}/admin/final-exam/${examId}/for-grading`);
    
    if (response.ok) {
      const data = await response.json();
      
      console.log('✅ API Response:');
      console.log(`📊 Answers: ${data.answers?.length || 0}`);
      console.log(`📊 ExistingGrades: ${data.existingGrades?.length || 0}`);
      
      if (data.existingGrades && data.existingGrades.length > 0) {
        console.log('\n🎉 SUCCESS! Grades are now being returned!');
        console.log('📋 Found grades:');
        data.existingGrades.forEach(grade => {
          const isProblematic = grade.maxScore === 1 && grade.score > 1;
          const status = isProblematic ? '🚨 PROBLEMATIC - WILL BE FILTERED' : '✅ OK';
          console.log(`   questionIndex ${grade.questionIndex}: ${grade.score}/${grade.maxScore} ${status}`);
        });
        
        const problematicCount = data.existingGrades.filter(g => g.maxScore === 1 && g.score > 1).length;
        console.log(`\n📊 Summary: ${problematicCount} problematic grades will be filtered out`);
        
      } else {
        console.log('\n❌ Still no grades returned - need more debugging');
      }
      
    } else {
      console.log(`❌ API call failed: ${response.status}`);
    }
    
  } catch (error) {
    console.error('❌ Error testing grades fix:', error.message);
  }
  
  console.log('\n🎯 Next steps:');
  console.log('1. 🔄 Hard refresh the browser (Ctrl+Shift+R)');
  console.log('2. 📱 Open Developer Tools (F12)');
  console.log('3. 👀 Check console for filtering messages');
  console.log('4. ✅ Should see grades loading and filtering working!');
}

testGradesFix();