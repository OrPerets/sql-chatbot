const { MongoClient } = require('mongodb');

async function debugKarshteinCase() {
  console.log('🔍 בודק את המקרה של קרשטיין בר...\n');
  
  const examId = '6878a0a3dd197423090e00d6';
  const questionSearchText = 'כתוב שאילתה שמחזירה את מספר הטייסים הפעילים בכל בסיס';
  
  console.log(`🎯 בחינה: ${examId}`);
  console.log(`🔍 שאלה: ${questionSearchText}\n`);
  
  const dbUserName = process.env.dbUserName || "sql-admin";
  const dbPassword = process.env.dbPassword || "SMff5PqhhoVbX6z7";
  const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
  
  const client = new MongoClient(connectionString);
  
  try {
    await client.connect();
    const db = client.db('experiment');
    const { ObjectId } = require('mongodb');
    
    const finalExam = await db.collection('finalExams').findOne({
      _id: new ObjectId(examId)
    });
    
    if (!finalExam) {
      console.log('❌ לא נמצאה בחינה עם ID זה');
      return;
    }
    
    console.log('✅ נמצאה בחינה ב-DB');
    console.log(`👤 סטודנט: ${finalExam.studentName || 'לא ידוע'}`);
    console.log(`📧 מייל: ${finalExam.studentEmail || 'לא ידוע'}`);
    
    if (!finalExam.mergedAnswers) {
      console.log('❌ אין mergedAnswers בבחינה');
      return;
    }
    
    console.log(`📝 סה"כ תשובות: ${finalExam.mergedAnswers.length}\n`);
    
    // חפש את השאלה הספציפית (ואת הכפילויות שלה)
    const matchingQuestions = finalExam.mergedAnswers.filter(answer => 
      answer.questionText && answer.questionText.includes(questionSearchText)
    );
    
    console.log(`🎯 נמצאו ${matchingQuestions.length} שאלות תואמות:`);
    
    if (matchingQuestions.length === 0) {
      console.log('❌ לא נמצאו שאלות תואמות');
      
      // הדפס כמה שאלות לדוגמא
      console.log('\n📝 דוגמאות שאלות בבחינה:');
      finalExam.mergedAnswers.slice(0, 5).forEach((answer, index) => {
        console.log(`   ${index + 1}. "${(answer.questionText || '').substring(0, 80)}..."`);
      });
      return;
    }
    
    matchingQuestions.forEach((q, index) => {
      console.log(`\n   ${index + 1}. questionIndex: ${q.questionIndex}`);
      console.log(`      תשובה: ${(q.studentAnswer || '').substring(0, 80)}...`);
      
      // בדוק אם יש ציון
      const hasGrade = finalExam.review?.questionGrades?.find(qg => qg.questionIndex === q.questionIndex);
      if (hasGrade) {
        console.log(`      ✅ יש ציון: ${hasGrade.score}/${hasGrade.maxScore}`);
        console.log(`      💬 הערה: "${hasGrade.feedback || 'אין הערה'}"`);
      } else {
        console.log(`      ❌ אין ציון`);
      }
    });
    
    // סיכום הבעיה
    console.log('\n📊 סיכום הבעיה:');
    const gradedQuestions = matchingQuestions.filter(q => 
      finalExam.review?.questionGrades?.some(qg => qg.questionIndex === q.questionIndex)
    );
    const ungradedQuestions = matchingQuestions.filter(q => 
      !finalExam.review?.questionGrades?.some(qg => qg.questionIndex === q.questionIndex)
    );
    
    console.log(`   ✅ שאלות עם ציון: ${gradedQuestions.length}`);
    console.log(`   ❌ שאלות ללא ציון: ${ungradedQuestions.length}`);
    
    if (gradedQuestions.length > 0 && ungradedQuestions.length > 0) {
      console.log('\n🎯 זוהתה בעיית כפילויות!');
      console.log('   exam-grading יציג את השאלה הראשונה (ללא ציון)');
      console.log('   grade-by-question ימצא את השאלה עם הציון');
      console.log('\n💡 הפתרון שלנו יתמודד עם זה על ידי העדפת השאלה עם הציון!');
    }
    
  } catch (error) {
    console.error('❌ שגיאה בבדיקה:', error.message);
  } finally {
    await client.close();
  }
}

debugKarshteinCase();