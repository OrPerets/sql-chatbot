const { MongoClient } = require('mongodb');

async function validateDataSync() {
  const dbUserName = process.env.dbUserName || "sql-admin";
  const dbPassword = process.env.dbPassword || "SMff5PqhhoVbX6z7";
  const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
  
  const client = new MongoClient(connectionString);
  
  try {
    console.log('🔍 בודק סנכרון נתונים בין grade-by-question ו-exam-grading...\n');
    
    await client.connect();
    const db = client.db('experiment');
    
    console.log('📊 מתי נתונים של grade-by-question ו-exam-grading:');
    console.log('='.repeat(70));
    
    // בדיקה 1: איך grade-by-question שומר נתונים
    console.log('🎯 grade-by-question שומר נתונים דרך:');
    console.log('   ✅ unified-grade-sync → /api/admin/grade-answer');
    console.log('   📍 מיקום: finalExams.review.questionGrades (עיקרי)');
    console.log('   🔄 סנכרון: examGrades collection (משני)\n');
    
    // בדיקה 2: איך exam-grading שומר נתונים  
    console.log('🎯 exam-grading שומר נתונים דרך:');
    console.log('   ⚠️  /api/admin/final-exam/:examId/grade או /api/admin/exam/:examId/grade');
    console.log('   📍 מיקום: ייתכן שרק examGrades או רק finalExams.review');
    console.log('   ❌ בעיה: אין סנכרון מובטח בין שני המקורות!\n');
    
    // בדיקה 3: השוואת נתונים בפועל
    console.log('🔍 בודק נתונים בפועל:');
    console.log('-'.repeat(50));
    
    // קבל את כל הבחינות עם ציונים מfinalExams
    const finalExamsWithGrades = await db.collection('finalExams').find({
      'review.questionGrades': { $exists: true, $ne: [] }
    }).toArray();
    
    // קבל את כל הציונים מexamGrades
    const examGrades = await db.collection('examGrades').find({
      questionGrades: { $exists: true, $ne: [] }
    }).toArray();
    
    console.log(`📊 finalExams עם ציונים: ${finalExamsWithGrades.length}`);
    console.log(`📊 examGrades רשומות: ${examGrades.length}`);
    
    // בדיקה 4: מציאת אי-התאמות
    console.log('\n🚨 בודק אי-התאמות:');
    console.log('-'.repeat(40));
    
    let syncIssues = [];
    let orphanedExamGrades = [];
    
    // בדוק אם יש examGrades ללא finalExams תואמות
    for (const examGrade of examGrades) {
      const examId = examGrade.examId?.toString();
      
      if (examId) {
        const matchingFinalExam = finalExamsWithGrades.find(fe => 
          fe._id.toString() === examId
        );
        
        if (!matchingFinalExam) {
          orphanedExamGrades.push({
            examId: examId,
            questionGradesCount: examGrade.questionGrades?.length || 0,
            zeroScoreNoFeedback: examGrade.questionGrades?.filter(qg => 
              qg.score === 0 && (!qg.feedback || qg.feedback.trim() === '')
            ).length || 0
          });
        } else {
          // בדוק אם יש אי-התאמה בציונים
          const finalExamGradesCount = matchingFinalExam.review?.questionGrades?.length || 0;
          const examGradesCount = examGrade.questionGrades?.length || 0;
          
          if (finalExamGradesCount !== examGradesCount) {
            syncIssues.push({
              examId: examId,
              finalExamGrades: finalExamGradesCount,
              examGradesCount: examGradesCount,
              difference: Math.abs(finalExamGradesCount - examGradesCount)
            });
          }
        }
      }
    }
    
    // בדיקה 5: דו"ח ממצאים
    console.log('\n📋 ממצאים:');
    console.log('='.repeat(50));
    
    if (orphanedExamGrades.length > 0) {
      console.log(`🚨 נמצאו ${orphanedExamGrades.length} רשומות examGrades ללא finalExams תואמות:`);
      orphanedExamGrades.forEach(item => {
        console.log(`   📌 בחינה ${item.examId}:`);
        console.log(`      📊 ${item.questionGradesCount} ציונים`);
        console.log(`      ❌ ${item.zeroScoreNoFeedback} ציונים 0 ללא הערה`);
      });
      console.log('');
    }
    
    if (syncIssues.length > 0) {
      console.log(`⚠️  נמצאו ${syncIssues.length} אי-התאמות בציונים בין המקורות:`);
      syncIssues.forEach(item => {
        console.log(`   📌 בחינה ${item.examId}:`);
        console.log(`      finalExams: ${item.finalExamGrades} ציונים`);
        console.log(`      examGrades: ${item.examGradesCount} ציונים`);
        console.log(`      הפרש: ${item.difference}`);
      });
      console.log('');
    }
    
    // בדיקה 6: ציונים 0 ללא הערה לפי מקור
    console.log('📊 ציונים 0 ללא הערה לפי מקור:');
    console.log('-'.repeat(40));
    
    let finalExamsZeroNoFeedback = 0;
    let examGradesZeroNoFeedback = 0;
    
    finalExamsWithGrades.forEach(exam => {
      if (exam.review?.questionGrades) {
        exam.review.questionGrades.forEach(qg => {
          if (qg.score === 0 && (!qg.feedback || qg.feedback.trim() === '')) {
            finalExamsZeroNoFeedback++;
          }
        });
      }
    });
    
    examGrades.forEach(grade => {
      if (grade.questionGrades) {
        grade.questionGrades.forEach(qg => {
          if (qg.score === 0 && (!qg.feedback || qg.feedback.trim() === '')) {
            examGradesZeroNoFeedback++;
          }
        });
      }
    });
    
    console.log(`📚 finalExams.review: ${finalExamsZeroNoFeedback} מקרים`);
    console.log(`📚 examGrades: ${examGradesZeroNoFeedback} מקרים`);
    console.log(`📊 סה"כ: ${finalExamsZeroNoFeedback + examGradesZeroNoFeedback} מקרים\n`);
    
    // בדיקה 7: המלצות לתיקון
    console.log('💡 המלצות לתיקון הסנכרון:');
    console.log('='.repeat(50));
    
    if (orphanedExamGrades.length > 0 || syncIssues.length > 0 || examGradesZeroNoFeedback > 0) {
      console.log('🔧 בעיות שנמצאו:');
      if (orphanedExamGrades.length > 0) {
        console.log(`   ❌ ${orphanedExamGrades.length} רשומות examGrades ללא finalExams תואמות`);
      }
      if (syncIssues.length > 0) {
        console.log(`   ⚠️  ${syncIssues.length} אי-התאמות בין המקורות`);
      }
      if (examGradesZeroNoFeedback > 0) {
        console.log(`   🚨 ${examGradesZeroNoFeedback} ציונים 0 ללא הערה בexamGrades`);
      }
      
      console.log('\n🎯 פתרונות מומלצים:');
      console.log('1. 🔄 עדכן exam-grading להשתמש ב-unified-grade-sync');
      console.log('2. 🧹 נקה רשומות orphaned בexamGrades');
      console.log('3. 📝 הוסף הערות לציונים 0 הקיימים');
      console.log('4. ✅ וודא שכל השמירות עוברות דרך unified-grade-sync');
      
      console.log('\n📋 סדר עדיפויות:');
      console.log('🥇 עדכן exam-grading לשימוש ב-unified-grade-sync');
      console.log('🥈 הוסף הערות לציונים 0 הקיימים');
      console.log('🥉 נקה נתונים ישנים/כפולים');
      
    } else {
      console.log('✅ הנתונים מסונכרנים בצורה טובה!');
      console.log('🎯 שני המקורות משתמשים באותם נתונים');
    }
    
    console.log('\n🏁 בדיקת סנכרון הושלמה!');
    
  } catch (error) {
    console.error('❌ שגיאה בבדיקת סנכרון:', error);
  } finally {
    await client.close();
  }
}

validateDataSync();