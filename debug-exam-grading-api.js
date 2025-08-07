const { MongoClient } = require('mongodb');

async function debugExamGradingAPI() {
  console.log('🔍 בודק בדיוק מה קורה כשנכנסים לעמוד exam-grading של מיקה רוס...\n');
  
  const examId = '6878a12b559dbb459f5eb4e3';
  const SERVER_BASE = 'https://mentor-server-theta.vercel.app';
  
  console.log(`🎯 בחינה: ${examId}`);
  console.log(`🌐 שרת: ${SERVER_BASE}\n`);
  
  // 1. בדיקה: איך exam-grading מקבל את נתוני הבחינה
  console.log('📚 שלב 1: איך exam-grading מקבל נתוני בחינה');
  console.log('='.repeat(60));
  
  try {
    // סימולציה של הקריאה ש-exam-grading עושה
    console.log('🔄 מנסה לקרוא מ-final-exam/for-grading...');
    
    const finalExamResponse = await fetch(`${SERVER_BASE}/admin/final-exam/${examId}/for-grading`);
    
    if (finalExamResponse.ok) {
      const finalExamData = await finalExamResponse.json();
      console.log('✅ final-exam/for-grading הצליח');
      console.log(`   👤 סטודנט: ${finalExamData.studentName || 'לא ידוע'}`);
      console.log(`   📧 מייל: ${finalExamData.studentEmail || 'לא ידוע'}`);
      
      if (finalExamData.mergedAnswers) {
        console.log(`   📝 mergedAnswers: ${finalExamData.mergedAnswers.length} תשובות`);
        
        // חפש את השאלה הבעייתית
        const efficiencyQuestions = finalExamData.mergedAnswers.filter(answer => 
          answer.questionText && answer.questionText.includes('בשאלה זו עליכם לחשב ולהציג את היעילות התפעולית')
        );
        
        console.log(`   🎯 נמצאו ${efficiencyQuestions.length} שאלות יעילות:`);
        efficiencyQuestions.forEach((q, index) => {
          console.log(`      ${index + 1}. questionIndex: ${q.questionIndex}`);
          console.log(`         תשובה: ${(q.studentAnswer || '').substring(0, 50)}...`);
        });
      }
      
      if (finalExamData.existingGrades) {
        console.log(`   🎯 existingGrades: ${finalExamData.existingGrades.length} ציונים`);
        finalExamData.existingGrades.forEach(grade => {
          if (grade.questionIndex === 5 || grade.questionIndex === 6) {
            console.log(`      שאלה ${grade.questionIndex}: ${grade.score}/${grade.maxScore}`);
            console.log(`      הערה: "${grade.feedback || 'אין הערה'}"`);
          }
        });
      } else {
        console.log('   ❌ אין existingGrades');
      }
    } else {
      console.log(`❌ final-exam/for-grading נכשל: ${finalExamResponse.status}`);
      
      // נסה fallback לregular exam
      console.log('🔄 מנסה fallback ל-exam/for-grading...');
      const regularExamResponse = await fetch(`${SERVER_BASE}/admin/exam/${examId}/for-grading`);
      
      if (regularExamResponse.ok) {
        console.log('✅ regular exam/for-grading הצליח');
      } else {
        console.log(`❌ גם regular exam/for-grading נכשל: ${regularExamResponse.status}`);
      }
    }
  } catch (error) {
    console.error('❌ שגיאה בבדיקת for-grading API:', error.message);
  }
  
  // 2. בדיקה: איך exam-grading מקבל ציונים קיימים
  console.log('\n📊 שלב 2: איך exam-grading מקבל ציונים קיימים');
  console.log('='.repeat(60));
  
  try {
    console.log('🔄 מנסה לקרוא מ-final-exam/grade...');
    
    const finalExamGradeResponse = await fetch(`${SERVER_BASE}/admin/final-exam/${examId}/grade`);
    
    if (finalExamGradeResponse.ok) {
      const gradeData = await finalExamGradeResponse.json();
      console.log('✅ final-exam/grade הצליח');
      console.log(`   📊 סה"כ ציון: ${gradeData.totalScore || 'לא ידוע'}`);
      console.log(`   📊 מקסימלי: ${gradeData.maxScore || 'לא ידוע'}`);
      
      if (gradeData.questionGrades) {
        console.log(`   🎯 questionGrades: ${gradeData.questionGrades.length} ציונים`);
        gradeData.questionGrades.forEach(grade => {
          if (grade.questionIndex === 5 || grade.questionIndex === 6) {
            console.log(`      שאלה ${grade.questionIndex}: ${grade.score}/${grade.maxScore}`);
            console.log(`      הערה: "${grade.feedback || 'אין הערה'}"`);
          }
        });
      }
    } else {
      console.log(`❌ final-exam/grade נכשל: ${finalExamGradeResponse.status}`);
      
      // נסה fallback
      console.log('🔄 מנסה fallback ל-exam/grade...');
      const regularGradeResponse = await fetch(`${SERVER_BASE}/admin/exam/${examId}/grade`);
      
      if (regularGradeResponse.ok) {
        const gradeData = await regularGradeResponse.json();
        console.log('✅ regular exam/grade הצליח');
        console.log(`   📊 סה"כ ציון: ${gradeData.totalScore || 'לא ידוע'}`);
      } else {
        console.log(`❌ גם regular exam/grade נכשל: ${regularGradeResponse.status}`);
      }
    }
  } catch (error) {
    console.error('❌ שגיאה בבדיקת grade API:', error.message);
  }
  
  // 3. בדיקה ישירה בDB
  console.log('\n💾 שלב 3: בדיקה ישירה בDB');
  console.log('='.repeat(40));
  
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
    
    if (finalExam) {
      console.log('✅ נמצאה בחינה ב-DB');
      
      // בדיקת השאלות הכפולות
      const efficiencyQuestions = finalExam.mergedAnswers.filter(answer => 
        answer.questionText && answer.questionText.includes('בשאלה זו עליכם לחשב ולהציג את היעילות התפעולית')
      );
      
      console.log(`🎯 שאלות יעילות ב-DB: ${efficiencyQuestions.length}`);
      efficiencyQuestions.forEach((q, index) => {
        console.log(`   ${index + 1}. questionIndex: ${q.questionIndex}`);
        
        // בדוק אם יש ציון
        const hasGrade = finalExam.review?.questionGrades?.find(qg => qg.questionIndex === q.questionIndex);
        if (hasGrade) {
          console.log(`      ✅ יש ציון: ${hasGrade.score}/${hasGrade.maxScore}`);
          console.log(`      💬 הערה: "${hasGrade.feedback || 'אין הערה'}"`);
        } else {
          console.log(`      ❌ אין ציון`);
        }
      });
    }
  } catch (error) {
    console.error('❌ שגיאה בבדיקת DB:', error.message);
  } finally {
    await client.close();
  }
  
  // 4. ההמלצה לפתרון
  console.log('\n💡 ניתוח הבעיה ופתרון:');
  console.log('='.repeat(50));
  console.log('🎯 הבעיה: exam-grading מציג את השאלה עם questionIndex 5 (ללא ציון)');
  console.log('🎯 הפתרון הנכון: grade-by-question מציג questionIndex 6 (עם ציון)');
  console.log('');
  console.log('🔧 פתרונות אפשריים:');
  console.log('1. 📋 העתק את הציון מ-questionIndex 6 ל-questionIndex 5');
  console.log('2. 🗑️ מחק את השאלה הכפולה (questionIndex 5)');
  console.log('3. 🔀 איחד את שתי השאלות לאחת');
  console.log('4. 🛠️ תקן את הלוגיקה של exam-grading להתעלם משאלות כפולות');
  
  console.log('\n🏁 בדיקת exam-grading API הושלמה!');
}

debugExamGradingAPI();