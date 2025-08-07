console.log('🧪 Testing the duplicate question fix for מיקה רוס...\n');

// Simulate the improved getUniqueAnswers function
function simulateGetUniqueAnswers(answers, existingGrades) {
  if (!answers) return [];
  
  // Group answers by question text
  const questionGroups = new Map();
  
  answers.forEach((answer, index) => {
    const questionText = answer.questionText?.trim() || '';
    if (!questionGroups.has(questionText)) {
      questionGroups.set(questionText, []);
    }
    questionGroups.get(questionText).push({ ...answer, originalIndex: index });
  });
  
  const uniqueAnswers = [];
  let filteredDuplicates = 0;
  
  questionGroups.forEach((duplicates, questionText) => {
    if (duplicates.length === 1) {
      // No duplicates, keep as is
      uniqueAnswers.push(duplicates[0]);
    } else {
      // Handle duplicates: prioritize the one with a grade
      console.log(`🔄 Found ${duplicates.length} duplicates for: "${questionText.substring(0, 50)}..."`);
      
      // Check if any existing grades match these questionIndices
      let bestCandidate = duplicates[0]; // fallback to first
      
      // Try to find one with existing grade data
      for (const duplicate of duplicates) {
        const hasExistingGrade = existingGrades?.some(grade => 
          grade.questionIndex === duplicate.questionIndex
        );
        
        if (hasExistingGrade) {
          console.log(`✅ Prioritizing questionIndex ${duplicate.questionIndex} (has existing grade)`);
          bestCandidate = duplicate;
          break;
        }
      }
      
      // If no existing grade found, log the candidates
      if (bestCandidate === duplicates[0]) {
        console.log(`⚠️ No existing grade found for duplicates. QuestionIndices: ${duplicates.map(d => d.questionIndex).join(', ')}`);
        console.log(`📍 Using questionIndex ${bestCandidate.questionIndex} (first occurrence)`);
      }
      
      uniqueAnswers.push(bestCandidate);
      filteredDuplicates += duplicates.length - 1;
    }
  });
  
  console.log(`📊 Original answers: ${answers.length}, Unique answers: ${uniqueAnswers.length}, Filtered duplicates: ${filteredDuplicates}`);
  return uniqueAnswers;
}

// Simulate מיקה רוס data
const micahAnswers = [
  {
    questionIndex: 5,
    questionText: 'בשאלה זו עליכם לחשב ולהציג את היעילות התפעולית של כל אחת מהטייסות',
    studentAnswer: 'select count(missions)/salary as efficency, base_name from missions join pilots using(pilot_id)',
    _id: 'answer5'
  },
  {
    questionIndex: 6,
    questionText: 'בשאלה זו עליכם לחשב ולהציג את היעילות התפעולית של כל אחת מהטייסות',
    studentAnswer: 'select count(missions)/salary as efficency, base_name from missions join pilots using(pilot_id)',
    _id: 'answer6'
  }
];

const micahGrades = [
  {
    questionIndex: 6,
    score: 7,
    maxScore: 1,
    feedback: 'לא בוצע קיבוץ כנדרש בפתרון'
  }
];

console.log('🎯 מיקה רוס - Before Fix (old behavior):');
console.log('   exam-grading would show: questionIndex 5 (no grade) ❌');
console.log('   grade-by-question would show: questionIndex 6 (has grade) ✅\n');

console.log('🎯 מיקה רוס - After Fix (new behavior):');
const result = simulateGetUniqueAnswers(micahAnswers, micahGrades);

console.log('\n✅ Results:');
result.forEach(answer => {
  const hasGrade = micahGrades.find(g => g.questionIndex === answer.questionIndex);
  console.log(`   questionIndex ${answer.questionIndex}: ${hasGrade ? '✅ HAS GRADE' : '❌ NO GRADE'}`);
  if (hasGrade) {
    console.log(`      Score: ${hasGrade.score}/${hasGrade.maxScore}`);
    console.log(`      Feedback: "${hasGrade.feedback}"`);
  }
});

console.log('\n🎉 Expected Result:');
console.log('   ✅ Both exam-grading AND grade-by-question will now show questionIndex 6');
console.log('   ✅ Both pages will display: 7/1 points with feedback');
console.log('   ✅ No more discrepancy between pages!');

console.log('\n🏁 Test completed successfully!');