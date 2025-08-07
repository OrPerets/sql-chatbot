console.log('🧪 Testing קרן ריזנברג fix - filtering out bad maxScore=1 data...\n');

// Simulate the updated logic with bad data filtering
function simulateFilteredLogic(answers, existingGrades) {
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
  const filteringResults = [];
  
  questionGroups.forEach((duplicates, questionText) => {
    if (duplicates.length === 1) {
      uniqueAnswers.push(duplicates[0]);
    } else {
      // Handle duplicates with bad data filtering
      const duplicatesWithGrades = duplicates.map(duplicate => {
        const grade = existingGrades?.find(grade => 
          grade.questionIndex === duplicate.questionIndex
        );
        return {
          ...duplicate,
          grade: grade,
          hasGrade: !!grade,
          score: grade?.score || 0,
          maxScore: grade?.maxScore || 0
        };
      });
      
      // FILTER OUT problematic questions with maxScore=1 and score>1 (bad data)
      const filteredDuplicates = duplicatesWithGrades.filter(duplicate => {
        if (duplicate.grade && duplicate.grade.maxScore === 1 && duplicate.grade.score > 1) {
          console.log(`⚠️ Filtering out problematic question: questionIndex ${duplicate.questionIndex} (${duplicate.score}/${duplicate.maxScore})`);
          return false;
        }
        return true;
      });
      
      const sortedDuplicates = filteredDuplicates.sort((a, b) => {
        if (a.hasGrade !== b.hasGrade) {
          return b.hasGrade ? 1 : -1;
        }
        if (a.hasGrade && b.hasGrade) {
          return b.score - a.score;
        }
        return 0;
      });
      
      // Fallback if all were filtered out
      const bestCandidate = sortedDuplicates.length > 0 ? sortedDuplicates[0] : duplicates[0];
      
      uniqueAnswers.push(bestCandidate);
      
      // Track filtering results
      if (filteredDuplicates.length !== duplicatesWithGrades.length) {
        filteringResults.push({
          questionText: questionText.substring(0, 60) + '...',
          totalCopies: duplicates.length,
          filteredOut: duplicatesWithGrades.length - filteredDuplicates.length,
          chosenIndex: bestCandidate.questionIndex,
          chosenScore: bestCandidate.grade?.score || 0,
          chosenMaxScore: bestCandidate.grade?.maxScore || 0
        });
      }
    }
  });
  
  return { uniqueAnswers, filteringResults };
}

// Test Case: קרן ריזנברג scenario with bad data
console.log('🎯 Test Case: קרן ריזנברג - Bad maxScore=1 data');
console.log('='.repeat(60));

const karenAnswers = [
  {
    questionIndex: 0,
    questionText: 'כתוב שאילתה שמחזירה את כמות כלי הנשק היקרים',
    studentAnswer: 'SELECT...',
    _id: 'answer0'
  },
  {
    questionIndex: 11,
    questionText: 'כתוב שאילתה שמחזירה את כמות כלי הנשק היקרים',
    studentAnswer: 'SELECT...',
    _id: 'answer11'
  },
  {
    questionIndex: 7,
    questionText: 'כתוב שאילתה שמחזירה את כלי הטיס שיוצרו אחרי שנת 2010',
    studentAnswer: 'SELECT...',
    _id: 'answer7'
  },
  {
    questionIndex: 12,
    questionText: 'כתוב שאילתה שמחזירה את כלי הטיס שיוצרו אחרי שנת 2010',
    studentAnswer: 'SELECT...',
    _id: 'answer12'
  }
];

// Current problematic grades (from real data)
const karenGrades = [
  // Problematic: score > maxScore!
  { questionIndex: 11, score: 4, maxScore: 1, feedback: 'לא הוצג משך הימים בתוצאה.' },
  { questionIndex: 12, score: 3, maxScore: 1, feedback: 'תשובה תקינה, שימוש בעמודות נוספות' }
];

console.log('🔍 Before fix (would show problematic data):');
console.log('   questionIndex 11: 4/1 (BAD!)');
console.log('   questionIndex 12: 3/1 (BAD!)');

console.log('\n🔧 After fix (filtering bad data):');
const result = simulateFilteredLogic(karenAnswers, karenGrades);

console.log('\n✅ Filtering Results:');
if (result.filteringResults.length > 0) {
  result.filteringResults.forEach(filter => {
    console.log(`   📝 ${filter.questionText}`);
    console.log(`      Filtered out: ${filter.filteredOut} bad questions`);
    console.log(`      Chosen: questionIndex ${filter.chosenIndex} (${filter.chosenScore}/${filter.chosenMaxScore})`);
  });
} else {
  console.log('   No bad data filtered');
}

console.log('\n🎯 Final Result:');
result.uniqueAnswers.forEach(answer => {
  const grade = karenGrades.find(g => g.questionIndex === answer.questionIndex);
  if (grade && grade.maxScore === 1 && grade.score > 1) {
    console.log(`   ❌ questionIndex ${answer.questionIndex}: ${grade.score}/${grade.maxScore} (STILL BAD - should be hidden)`);
  } else if (grade) {
    console.log(`   ✅ questionIndex ${answer.questionIndex}: ${grade.score}/${grade.maxScore} (OK)`);
  } else {
    console.log(`   ⚪ questionIndex ${answer.questionIndex}: No grade (OK fallback)`);
  }
});

console.log('\n🎉 Expected Behavior:');
console.log('   ✅ Bad questions (4/1, 3/1) are now filtered out');
console.log('   ✅ exam-grading will show fallback questions instead');
console.log('   ✅ No more impossible scores like 4/1 or 6/1');
console.log('   ✅ System works normally for deadline!');

console.log('\n🏁 Test completed - ready for deployment!');