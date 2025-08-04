const { MongoClient } = require('mongodb');

async function analyzeZeroScoresWithoutFeedback() {
  // Use the same connection string as the mentor-server
  const dbUserName = process.env.dbUserName || "sql-admin";
  const dbPassword = process.env.dbPassword || "SMff5PqhhoVbX6z7";
  const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
  
  const client = new MongoClient(connectionString);
  
  try {
    console.log('🔍 מתחיל בדיקה של ציונים 0 ללא הערות...\n');
    
    await client.connect();
    const db = client.db('experiment');
    
    // בדיקה באוסף finalExams - הנתונים העיקריים
    console.log('📚 בודק finalExams.review.questionGrades...');
    const finalExamsResults = await db.collection('finalExams').find({
      'review.questionGrades': { $exists: true, $ne: [] }
    }).toArray();
    
    let zeroScoreNoFeedbackCases = [];
    let totalQuestionsChecked = 0;
    let totalZeroScores = 0;
    
    for (const exam of finalExamsResults) {
      if (!exam.review || !exam.review.questionGrades) continue;
      
      for (const qg of exam.review.questionGrades) {
        totalQuestionsChecked++;
        
        if (qg.score === 0) {
          totalZeroScores++;
          
          // בדיקה אם אין הערה או שההערה ריקה
          const hasFeedback = qg.feedback && qg.feedback.trim() !== '';
          
          if (!hasFeedback) {
            zeroScoreNoFeedbackCases.push({
              examId: exam._id,
              studentId: exam.studentId,
              questionIndex: qg.questionIndex,
              score: qg.score,
              maxScore: qg.maxScore,
              feedback: qg.feedback || 'undefined',
              gradedAt: qg.gradedAt,
              examData: {
                totalScore: exam.review?.totalScore,
                maxScore: exam.review?.maxScore,
                isGraded: exam.review?.isGraded
              }
            });
          }
        }
      }
    }
    
    // בדיקה גם באוסף examGrades לצורך השלמה
    console.log('📚 בודק examGrades collection...');
    const examGradesResults = await db.collection('examGrades').find({
      questionGrades: { $exists: true, $ne: [] }
    }).toArray();
    
    let examGradesZeroNoFeedback = [];
    
    for (const grade of examGradesResults) {
      if (!grade.questionGrades) continue;
      
      for (const qg of grade.questionGrades) {
        if (qg.score === 0) {
          const hasFeedback = qg.feedback && qg.feedback.trim() !== '';
          
          if (!hasFeedback) {
            examGradesZeroNoFeedback.push({
              examId: grade.examId,
              questionIndex: qg.questionIndex,
              score: qg.score,
              maxScore: qg.maxScore,
              feedback: qg.feedback || 'undefined',
              gradedAt: qg.gradedAt
            });
          }
        }
      }
    }
    
    // דוח סיכום
    console.log('\n📊 דוח ניתוח:');
    console.log('='.repeat(60));
    console.log(`סה"כ שאלות שנבדקו: ${totalQuestionsChecked}`);
    console.log(`סה"כ ציונים 0: ${totalZeroScores}`);
    console.log(`ציונים 0 ללא הערה (finalExams): ${zeroScoreNoFeedbackCases.length}`);
    console.log(`ציונים 0 ללא הערה (examGrades): ${examGradesZeroNoFeedback.length}`);
    
    if (zeroScoreNoFeedbackCases.length > 0) {
      console.log('\n🚨 מקרים חשודים מ-finalExams:');
      console.log('-'.repeat(60));
      
      // קיבוץ לפי סטודנטים
      const byStudent = {};
      zeroScoreNoFeedbackCases.forEach(case_ => {
        if (!byStudent[case_.studentId]) {
          byStudent[case_.studentId] = [];
        }
        byStudent[case_.studentId].push(case_);
      });
      
      Object.keys(byStudent).forEach(studentId => {
        const studentCases = byStudent[studentId];
        console.log(`\n👤 סטודנט: ${studentId}`);
        console.log(`   📝 ${studentCases.length} שאלות עם ציון 0 ללא הערה`);
        
        studentCases.forEach(case_ => {
          console.log(`   📌 שאלה ${case_.questionIndex}: ${case_.score}/${case_.maxScore}`);
          console.log(`      📅 מתי דורג: ${case_.gradedAt || 'לא ידוע'}`);
          console.log(`      💬 הערה: "${case_.feedback}"`);
          console.log(`      🎯 בחינה: ${case_.examId}`);
          console.log(`      📊 ציון כללי: ${case_.examData.totalScore}/${case_.examData.maxScore}`);
        });
      });
    }
    
    if (examGradesZeroNoFeedback.length > 0) {
      console.log('\n🚨 מקרים חשודים מ-examGrades:');
      console.log('-'.repeat(60));
      examGradesZeroNoFeedback.slice(0, 10).forEach((case_, idx) => {
        console.log(`${idx + 1}. בחינה ${case_.examId}, שאלה ${case_.questionIndex}: ${case_.score}/${case_.maxScore}`);
        console.log(`   💬 הערה: "${case_.feedback}"`);
      });
      
      if (examGradesZeroNoFeedback.length > 10) {
        console.log(`   ... ועוד ${examGradesZeroNoFeedback.length - 10} מקרים`);
      }
    }
    
    // סטטיסטיקות נוספות
    console.log('\n📈 סטטיסטיקות נוספות:');
    console.log('-'.repeat(40));
    
    if (totalZeroScores > 0) {
      const percentageWithoutFeedback = ((zeroScoreNoFeedbackCases.length / totalZeroScores) * 100).toFixed(1);
      console.log(`אחוז מציוני 0 ללא הערה: ${percentageWithoutFeedback}%`);
    }
    
    // בדיקה של דפוסים בזמן
    if (zeroScoreNoFeedbackCases.length > 0) {
      const withDates = zeroScoreNoFeedbackCases.filter(c => c.gradedAt);
      if (withDates.length > 0) {
        withDates.sort((a, b) => new Date(a.gradedAt) - new Date(b.gradedAt));
        console.log(`טווח תאריכים: ${withDates[0].gradedAt} עד ${withDates[withDates.length - 1].gradedAt}`);
      }
    }
    
    // המלצות
    console.log('\n💡 המלצות:');
    console.log('-'.repeat(40));
    if (zeroScoreNoFeedbackCases.length > 0) {
      console.log('⚠️  נמצאו מקרים של ציונים 0 ללא הערה');
      console.log('🔧 כדאי לבדוק האם אלו מקרים שבהם לא נשמרו ההערות');
      console.log('📝 מומלץ לעבור על המקרים הללו ולהוסיף הערות במידת הצורך');
    } else {
      console.log('✅ לא נמצאו מקרים בעייתיים - כל ציוני ה-0 כוללים הערות');
    }
    
    console.log('\n🏁 ניתוח הושלם בהצלחה!');
    
  } catch (error) {
    console.error('❌ שגיאה בניתוח:', error);
  } finally {
    await client.close();
  }
}

// הרצה
analyzeZeroScoresWithoutFeedback();