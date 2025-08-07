const { MongoClient } = require('mongodb');

// Simulate the improved getUniqueAnswers function with highest grade priority
function simulateImprovedLogic(answers, existingGrades) {
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
  const prioritizationResults = [];
  
  questionGroups.forEach((duplicates, questionText) => {
    if (duplicates.length === 1) {
      uniqueAnswers.push(duplicates[0]);
    } else {
      // Handle duplicates: prioritize the one with the HIGHEST grade
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
        if (a.hasGrade !== b.hasGrade) {
          return b.hasGrade ? 1 : -1;
        }
        if (a.hasGrade && b.hasGrade) {
          return b.score - a.score;
        }
        return 0;
      });
      
      const bestCandidate = sortedDuplicates[0];
      uniqueAnswers.push(bestCandidate);
      
      // Store result for analysis
      prioritizationResults.push({
        questionText: questionText.substring(0, 80) + '...',
        totalCopies: duplicates.length,
        chosenIndex: bestCandidate.questionIndex,
        chosenScore: bestCandidate.score,
        chosenMaxScore: bestCandidate.maxScore,
        chosenFeedback: bestCandidate.grade?.feedback || 'אין הערה',
        allVersions: sortedDuplicates.map(d => ({
          questionIndex: d.questionIndex,
          score: d.score,
          maxScore: d.maxScore,
          hasGrade: d.hasGrade
        }))
      });
    }
  });
  
  return { uniqueAnswers, prioritizationResults };
}

async function testRealDataHighestGrade() {
  console.log('🧪 בדיקת הלוגיקה החדשה על נתונים אמיתיים...\n');
  
  const testCases = [
    { examId: '6878a0a3dd197423090e00d6', studentName: 'קרשטיין בר' },
    { examId: '6878a12b559dbb459f5eb4e3', studentName: 'מיקה רוס' },
    { examId: '68789db89502ade90c6bf3d5', studentName: 'שמש אלמוג' }
  ];
  
  const dbUserName = process.env.dbUserName || "sql-admin";
  const dbPassword = process.env.dbPassword || "SMff5PqhhoVbX6z7";
  const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
  
  const client = new MongoClient(connectionString);
  
  try {
    await client.connect();
    const db = client.db('experiment');
    const { ObjectId } = require('mongodb');
    
    for (const testCase of testCases) {
      console.log(`🎯 בודק: ${testCase.studentName} (${testCase.examId})`);
      console.log('='.repeat(60));
      
      const finalExam = await db.collection('finalExams').findOne({
        _id: new ObjectId(testCase.examId)
      });
      
      if (!finalExam || !finalExam.mergedAnswers) {
        console.log('❌ לא נמצאה בחינה או mergedAnswers\n');
        continue;
      }
      
      const existingGrades = finalExam.review?.questionGrades || [];
      const result = simulateImprovedLogic(finalExam.mergedAnswers, existingGrades);
      
      console.log(`📊 סה"כ שאלות: ${finalExam.mergedAnswers.length} → ${result.uniqueAnswers.length} ייחודיות`);
      
      if (result.prioritizationResults.length > 0) {
        console.log(`🔧 תוקנו ${result.prioritizationResults.length} מקרי כפילויות:\n`);
        
        result.prioritizationResults.forEach((fix, index) => {
          console.log(`   ${index + 1}. 📝 ${fix.questionText}`);
          console.log(`      🎯 נבחר: questionIndex ${fix.chosenIndex}`);
          console.log(`      📊 ציון: ${fix.chosenScore}/${fix.chosenMaxScore}`);
          console.log(`      💬 הערה: "${fix.chosenFeedback}"`);
          
          if (fix.allVersions.length > 1) {
            console.log(`      🔍 כל הגרסאות:`);
            fix.allVersions.forEach(version => {
              const marker = version.questionIndex === fix.chosenIndex ? '✅' : '❌';
              console.log(`         ${marker} questionIndex ${version.questionIndex}: ${version.score}/${version.maxScore} ${version.hasGrade ? '(מדורג)' : '(לא מדורג)'}`);
            });
          }
          console.log('');
        });
      } else {
        console.log('✅ לא נמצאו כפילויות לטיפול\n');
      }
    }
    
    console.log('🎉 בדיקה הושלמה בהצלחה!');
    console.log('\n💡 מה זה אומר:');
    console.log('   ✅ exam-grading יציג תמיד את הגרסה עם הציון הגבוה ביותר');
    console.log('   ✅ אם grade-by-question מציג ציון גבוה יותר, גם exam-grading יציג אותו');
    console.log('   ✅ אם יש מספר ציונים לאותה שאלה, הגבוה ביותר ינצח');
    console.log('   ✅ הערות יועתקו מהגרסה עם הציון הגבוה ביותר');
    
  } catch (error) {
    console.error('❌ שגיאה:', error.message);
  } finally {
    await client.close();
  }
}

testRealDataHighestGrade();