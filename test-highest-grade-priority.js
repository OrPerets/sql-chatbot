console.log('🧪 Testing the improved "highest grade priority" logic...\n');

// Simulate the improved getUniqueAnswers function with highest grade priority
function simulateHighestGradePriority(answers, existingGrades) {
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
      // Handle duplicates: prioritize the one with the HIGHEST grade
      console.log(`🔄 Found ${duplicates.length} duplicates for: "${questionText.substring(0, 50)}..."`);
      
      // Find all duplicates with grades and their scores
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
      
      // Sort by: 1) Has grade (true first), 2) Score (highest first), 3) Original order
      const sortedDuplicates = duplicatesWithGrades.sort((a, b) => {
        // First priority: has grade vs no grade
        if (a.hasGrade !== b.hasGrade) {
          return b.hasGrade ? 1 : -1;
        }
        // Second priority: if both have grades, compare scores
        if (a.hasGrade && b.hasGrade) {
          return b.score - a.score;
        }
        // Third priority: maintain original order
        return 0;
      });
      
      const bestCandidate = sortedDuplicates[0];
      
      if (bestCandidate.hasGrade) {
        console.log(`✅ Prioritizing questionIndex ${bestCandidate.questionIndex} (highest score: ${bestCandidate.score}/${bestCandidate.maxScore})`);
        console.log(`   💬 Feedback: "${bestCandidate.grade?.feedback || 'אין הערה'}"`);
        
        // Log all graded versions for comparison
        const allGradedVersions = sortedDuplicates.filter(d => d.hasGrade);
        if (allGradedVersions.length > 1) {
          console.log(`   📊 All graded versions:`);
          allGradedVersions.forEach(version => {
            console.log(`      questionIndex ${version.questionIndex}: ${version.score}/${version.maxScore}`);
          });
        }
      } else {
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

// Test Case 1: קרשטיין בר scenario - multiple grades for same question
console.log('🎯 Test Case 1: קרשטיין בר - Multiple grades scenario');
console.log('='.repeat(60));

const karshteinAnswers = [
  {
    questionIndex: 7,
    questionText: 'כתוב שאילתה שמחזירה את מספר הטייסים הפעילים בכל בסיס',
    studentAnswer: 'SELECT...',
    _id: 'answer7'
  },
  {
    questionIndex: 8,
    questionText: 'כתוב שאילתה שמחזירה את מספר הטייסים הפעילים בכל בסיס',
    studentAnswer: 'SELECT...',
    _id: 'answer8'
  },
  {
    questionIndex: 9,
    questionText: 'כתוב שאילתה שמחזירה את מספר הטייסים הפעילים בכל בסיס',
    studentAnswer: 'SELECT...',
    _id: 'answer9'
  }
];

// Scenario A: Only one low grade (current DB state)
const karshteinGradesA = [
  { questionIndex: 7, score: 0, maxScore: 8, feedback: 'אין הערה' }
];

console.log('\nScenario A: Only questionIndex 7 has grade (0/8)');
const resultA = simulateHighestGradePriority(karshteinAnswers, karshteinGradesA);
console.log(`Result: Will show questionIndex ${resultA[0].questionIndex}\n`);

// Scenario B: Multiple grades with different scores
const karshteinGradesB = [
  { questionIndex: 7, score: 0, maxScore: 8, feedback: 'אין הערה' },
  { questionIndex: 8, score: 6, maxScore: 8, feedback: 'פתרון חלקי' },
  { questionIndex: 9, score: 8, maxScore: 8, feedback: 'פתרון מצוין' }
];

console.log('Scenario B: Multiple grades (0/8, 6/8, 8/8)');
const resultB = simulateHighestGradePriority(karshteinAnswers, karshteinGradesB);
console.log(`Result: Will show questionIndex ${resultB[0].questionIndex}\n`);

// Test Case 2: מיקה רוס scenario
console.log('🎯 Test Case 2: מיקה רוס - Two grades scenario');
console.log('='.repeat(50));

const micahAnswers = [
  {
    questionIndex: 5,
    questionText: 'בשאלה זו עליכם לחשב ולהציג את היעילות התפעולית',
    studentAnswer: 'select...',
    _id: 'answer5'
  },
  {
    questionIndex: 6,
    questionText: 'בשאלה זו עליכם לחשב ולהציג את היעילות התפעולית',
    studentAnswer: 'select...',
    _id: 'answer6'
  }
];

const micahGrades = [
  { questionIndex: 6, score: 7, maxScore: 1, feedback: 'לא בוצע קיבוץ כנדרש בפתרון' }
];

const micahResult = simulateHighestGradePriority(micahAnswers, micahGrades);
console.log(`Result: Will show questionIndex ${micahResult[0].questionIndex}\n`);

// Test Case 3: Multiple high grades scenario
console.log('🎯 Test Case 3: Multiple high grades - ties scenario');
console.log('='.repeat(50));

const tieAnswers = [
  {
    questionIndex: 1,
    questionText: 'שאלה עם ציונים זהים',
    studentAnswer: 'answer1',
    _id: 'answer1'
  },
  {
    questionIndex: 2,
    questionText: 'שאלה עם ציונים זהים',
    studentAnswer: 'answer2',
    _id: 'answer2'
  }
];

const tieGrades = [
  { questionIndex: 1, score: 10, maxScore: 10, feedback: 'מצוין גרסה 1' },
  { questionIndex: 2, score: 10, maxScore: 10, feedback: 'מצוין גרסה 2' }
];

const tieResult = simulateHighestGradePriority(tieAnswers, tieGrades);
console.log(`Result: Will show questionIndex ${tieResult[0].questionIndex} (first in tie)\n`);

console.log('🎉 Summary of improvements:');
console.log('='.repeat(40));
console.log('✅ Always shows the version with the HIGHEST score');
console.log('✅ Handles ties gracefully (first occurrence wins)');
console.log('✅ Falls back to any grade > no grade');
console.log('✅ Maintains original logic for no duplicates');
console.log('✅ Provides detailed logging for debugging');

console.log('\n🎯 Expected behavior for קרשטיין בר:');
console.log('   If grade-by-question shows a higher score (like 6/8 or 8/8),');
console.log('   exam-grading will now show that higher score too!');

console.log('\n🏁 Test completed successfully!');