const { MongoClient } = require('mongodb');

async function detailedZeroScoresAnalysis() {
  // Use the same connection string as the mentor-server
  const dbUserName = process.env.dbUserName || "sql-admin";
  const dbPassword = process.env.dbPassword || "SMff5PqhhoVbX6z7";
  const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
  
  const client = new MongoClient(connectionString);
  
  try {
    console.log('🔍 מתחיל ניתוח מפורט של ציונים 0 ללא הערות...\n');
    
    await client.connect();
    const db = client.db('experiment');
    
    let allCases = [];
    
    // בדיקה באוסף finalExams
    console.log('📚 בודק finalExams collection...');
    const finalExamsResults = await db.collection('finalExams').find({
      'review.questionGrades': { $exists: true, $ne: [] }
    }).toArray();
    
    for (const exam of finalExamsResults) {
      if (!exam.review || !exam.review.questionGrades) continue;
      
      for (const qg of exam.review.questionGrades) {
        if (qg.score === 0) {
          const hasFeedback = qg.feedback && qg.feedback.trim() !== '';
          
          if (!hasFeedback) {
            allCases.push({
              source: 'finalExams',
              examId: exam._id.toString(),
              studentId: exam.studentId,
              questionIndex: qg.questionIndex,
              score: qg.score,
              maxScore: qg.maxScore,
              feedback: qg.feedback || 'undefined',
              gradedAt: qg.gradedAt,
              examMetadata: {
                totalScore: exam.review?.totalScore,
                maxScore: exam.review?.maxScore,
                isGraded: exam.review?.isGraded,
                examDate: exam.createdAt
              }
            });
          }
        }
      }
    }
    
    // בדיקה באוסף examGrades
    console.log('📚 בודק examGrades collection...');
    const examGradesResults = await db.collection('examGrades').find({
      questionGrades: { $exists: true, $ne: [] }
    }).toArray();
    
    for (const grade of examGradesResults) {
      if (!grade.questionGrades) continue;
      
      for (const qg of grade.questionGrades) {
        if (qg.score === 0) {
          const hasFeedback = qg.feedback && qg.feedback.trim() !== '';
          
          if (!hasFeedback) {
            allCases.push({
              source: 'examGrades',
              examId: grade.examId,
              studentId: grade.studentId || 'unknown',
              questionIndex: qg.questionIndex,
              score: qg.score,
              maxScore: qg.maxScore,
              feedback: qg.feedback || 'undefined',
              gradedAt: qg.gradedAt,
              examMetadata: null
            });
          }
        }
      }
    }
    
    // מיון לפי examId ואז לפי questionIndex
    allCases.sort((a, b) => {
      if (a.examId !== b.examId) {
        return a.examId.localeCompare(b.examId);
      }
      return a.questionIndex - b.questionIndex;
    });
    
    console.log(`\n📋 רשימה מפורטת של ${allCases.length} מקרים:\n`);
    console.log('='.repeat(100));
    
    let currentExamId = null;
    let examCaseCount = 0;
    
    allCases.forEach((case_, index) => {
      // אם זה בחינה חדשה, הצג כותרת
      if (currentExamId !== case_.examId) {
        if (currentExamId !== null) {
          console.log(`   └── סה"כ ${examCaseCount} שאלות עם ציון 0 ללא הערה בבחינה זו\n`);
        }
        
        currentExamId = case_.examId;
        examCaseCount = 0;
        
        console.log(`🎯 בחינה: ${case_.examId}`);
        console.log(`   📊 מקור הנתונים: ${case_.source}`);
        if (case_.examMetadata && case_.examMetadata.examDate) {
          console.log(`   📅 תאריך בחינה: ${new Date(case_.examMetadata.examDate).toLocaleDateString('he-IL')}`);
        }
        if (case_.examMetadata) {
          console.log(`   🏆 ציון כללי: ${case_.examMetadata.totalScore}/${case_.examMetadata.maxScore}`);
        }
        console.log('');
      }
      
      examCaseCount++;
      
      console.log(`   📌 שאלה ${case_.questionIndex}:`);
      console.log(`      👤 סטודנט: ${case_.studentId}`);
      console.log(`      🎯 ציון: ${case_.score}/${case_.maxScore}`);
      console.log(`      💬 הערה: "${case_.feedback}"`);
      if (case_.gradedAt) {
        console.log(`      📅 תאריך דירוג: ${new Date(case_.gradedAt).toLocaleDateString('he-IL')}`);
      }
      console.log('');
    });
    
    // הצגת הסיכום לבחינה האחרונה
    if (currentExamId !== null) {
      console.log(`   └── סה"כ ${examCaseCount} שאלות עם ציון 0 ללא הערה בבחינה זו\n`);
    }
    
    // סיכום לפי בחינות
    console.log('📈 סיכום לפי בחינות:');
    console.log('='.repeat(60));
    
    const examSummary = {};
    allCases.forEach(case_ => {
      if (!examSummary[case_.examId]) {
        examSummary[case_.examId] = {
          count: 0,
          questions: [],
          source: case_.source,
          students: new Set()
        };
      }
      examSummary[case_.examId].count++;
      examSummary[case_.examId].questions.push(case_.questionIndex);
      examSummary[case_.examId].students.add(case_.studentId);
    });
    
    Object.keys(examSummary).forEach(examId => {
      const summary = examSummary[examId];
      console.log(`🎯 ${examId}:`);
      console.log(`   📊 ${summary.count} מקרים`);
      console.log(`   📝 שאלות: ${[...new Set(summary.questions)].sort((a,b) => a-b).join(', ')}`);
      console.log(`   👥 ${summary.students.size} סטודנטים שונים`);
      console.log(`   💾 מקור: ${summary.source}`);
      console.log('');
    });
    
    console.log('🏁 ניתוח מפורט הושלם בהצלחה!');
    
  } catch (error) {
    console.error('❌ שגיאה בניתוח:', error);
  } finally {
    await client.close();
  }
}

// הרצה
detailedZeroScoresAnalysis();