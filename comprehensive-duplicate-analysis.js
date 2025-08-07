const { MongoClient } = require('mongodb');

async function comprehensiveDuplicateAnalysis() {
  console.log('🔍 ניתוח מקיף של בעיית השאלות הכפולות בכל הבחינות\n');
  
  const dbUserName = process.env.dbUserName || "sql-admin";
  const dbPassword = process.env.dbPassword || "SMff5PqhhoVbX6z7";
  const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
  
  const client = new MongoClient(connectionString);
  
  try {
    await client.connect();
    const db = client.db('experiment');
    
    console.log('🔄 טוען את כל הבחינות...');
    const finalExams = await db.collection('finalExams').find({}).toArray();
    console.log(`✅ נטענו ${finalExams.length} בחינות\n`);
    
    let totalProblematicExams = 0;
    let totalDuplicateQuestions = 0;
    let totalAffectedQuestions = 0;
    const problematicCases = [];
    
    for (const exam of finalExams) {
      if (!exam.mergedAnswers || exam.mergedAnswers.length === 0) {
        continue;
      }
      
      // קבץ שאלות לפי תוכן
      const questionGroups = new Map();
      
      exam.mergedAnswers.forEach((answer, index) => {
        const questionText = (answer.questionText || '').trim();
        if (questionText.length < 10) return; // דלג על שאלות קצרות מדי
        
        if (!questionGroups.has(questionText)) {
          questionGroups.set(questionText, []);
        }
        questionGroups.get(questionText).push({
          questionIndex: answer.questionIndex,
          studentAnswer: answer.studentAnswer,
          hasGrade: exam.review?.questionGrades?.some(qg => qg.questionIndex === answer.questionIndex),
          grade: exam.review?.questionGrades?.find(qg => qg.questionIndex === answer.questionIndex)
        });
      });
      
      // מצא כפילויות
      const duplicatesInExam = [];
      
      questionGroups.forEach((copies, questionText) => {
        if (copies.length > 1) {
          const gradedCopies = copies.filter(c => c.hasGrade);
          const ungradedCopies = copies.filter(c => !c.hasGrade);
          
          if (gradedCopies.length > 0 && ungradedCopies.length > 0) {
            // זוהתה בעיה: יש עותקים מדורגים ולא מדורגים
            duplicatesInExam.push({
              questionText: questionText.substring(0, 80) + '...',
              totalCopies: copies.length,
              gradedCopies: gradedCopies.length,
              ungradedCopies: ungradedCopies.length,
              questionIndices: copies.map(c => c.questionIndex).sort(),
              gradedIndices: gradedCopies.map(c => c.questionIndex).sort(),
              ungradedIndices: ungradedCopies.map(c => c.questionIndex).sort()
            });
            
            totalAffectedQuestions++;
            totalDuplicateQuestions += copies.length;
          }
        }
      });
      
      if (duplicatesInExam.length > 0) {
        totalProblematicExams++;
        problematicCases.push({
          examId: exam._id.toString(),
          studentName: exam.studentName || 'לא ידוע',
          studentEmail: exam.studentEmail || 'לא ידוע',
          duplicates: duplicatesInExam
        });
      }
    }
    
    // דוח מקיף
    console.log('📊 תוצאות הניתוח המקיף:');
    console.log('='.repeat(50));
    console.log(`🎯 בחינות עם בעיות: ${totalProblematicExams} מתוך ${finalExams.length}`);
    console.log(`📝 שאלות מושפעות: ${totalAffectedQuestions}`);
    console.log(`🔄 סה"כ שאלות כפולות: ${totalDuplicateQuestions}`);
    console.log('');
    
    if (problematicCases.length > 0) {
      console.log('🚨 רשימת המקרים הבעייתיים:');
      console.log('='.repeat(60));
      
      problematicCases.forEach((examCase, index) => {
        console.log(`\n${index + 1}. 👤 ${examCase.studentName} (${examCase.examId})`);
        console.log(`   📧 ${examCase.studentEmail}`);
        
        examCase.duplicates.forEach((dup, dupIndex) => {
          console.log(`\n   🔄 כפילות ${dupIndex + 1}:`);
          console.log(`      📝 שאלה: ${dup.questionText}`);
          console.log(`      📊 סה"כ עותקים: ${dup.totalCopies}`);
          console.log(`      ✅ עם ציון: ${dup.gradedCopies} (indices: ${dup.gradedIndices.join(', ')})`);
          console.log(`      ❌ ללא ציון: ${dup.ungradedCopies} (indices: ${dup.ungradedIndices.join(', ')})`);
        });
      });
      
      // המלצות לפתרון
      console.log('\n\n💡 אסטרטגיית פתרון:');
      console.log('='.repeat(40));
      console.log('🔧 1. הפתרון הקיים (מוטמע): exam-grading יעדיף שאלות עם ציונים');
      console.log('🔧 2. פתרון נוסף: העתק ציונים משאלות מדורגות לשאלות לא מדורגות');
      console.log('🔧 3. פתרון יסודי: מחק שאלות כפולות ללא ציונים');
      console.log('🔧 4. מניעה: תקן את תהליך יצירת הבחינות');
      
      // שמירת הדוח
      const reportPath = `duplicate-questions-report-${new Date().toISOString().split('T')[0]}.json`;
      const fs = require('fs');
      fs.writeFileSync(reportPath, JSON.stringify(problematicCases, null, 2));
      console.log(`\n💾 הדוח נשמר ב: ${reportPath}`);
      
    } else {
      console.log('✅ לא נמצאו בעיות כפילויות!');
    }
    
  } catch (error) {
    console.error('❌ שגיאה בניתוח:', error.message);
  } finally {
    await client.close();
  }
}

comprehensiveDuplicateAnalysis();