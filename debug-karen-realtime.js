const { MongoClient } = require('mongodb');

async function debugKarenRealtime() {
  console.log('🚨 בדיקה בזמן אמת של מה שקורה בבחינה של קרן ריזנברג...\n');
  
  const examId = '6878a7e32c796f9cd66e406c';
  const SERVER_BASE = 'https://mentor-server-theta.vercel.app';
  
  try {
    // 1. בדוק מה exam-grading API מחזיר
    console.log('1️⃣ בודק מה exam-grading מקבל מהAPI...');
    
    const finalExamResponse = await fetch(`${SERVER_BASE}/admin/final-exam/${examId}/for-grading`);
    if (finalExamResponse.ok) {
      const examData = await finalExamResponse.json();
      console.log(`✅ קיבל ${examData.mergedAnswers?.length || 0} תשובות`);
      console.log(`✅ קיבל ${examData.existingGrades?.length || 0} ציונים קיימים`);
      
      // הראה את הציונים הקיימים
      if (examData.existingGrades) {
        console.log('\n📊 ציונים קיימים מהAPI:');
        examData.existingGrades.forEach(grade => {
          const isProblematic = grade.maxScore === 1 && grade.score > 1;
          const marker = isProblematic ? '🚨' : '✅';
          console.log(`   ${marker} questionIndex ${grade.questionIndex}: ${grade.score}/${grade.maxScore} ${isProblematic ? '(PROBLEMATIC!)' : ''}`);
        });
      }
    } else {
      console.log(`❌ שגיאה בAPI: ${finalExamResponse.status}`);
    }
    
  } catch (error) {
    console.error('❌ שגיאה בבדיקת API:', error.message);
  }
  
  // 2. בדוק ישירות בDB
  console.log('\n2️⃣ בדיקה ישירה בDB...');
  
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
      console.log('✅ נמצאה בחינה בDB');
      
      const grades = finalExam.review?.questionGrades || [];
      console.log(`📊 ציונים בDB: ${grades.length}`);
      
      // מצא ציונים בעייתיים
      const problematicGrades = grades.filter(grade => grade.maxScore === 1 && grade.score > 1);
      
      if (problematicGrades.length > 0) {
        console.log(`\n🚨 נמצאו ${problematicGrades.length} ציונים בעייתיים בDB:`);
        problematicGrades.forEach(grade => {
          console.log(`   questionIndex ${grade.questionIndex}: ${grade.score}/${grade.maxScore}`);
          console.log(`   הערה: "${grade.feedback || 'אין הערה'}"`);
        });
      } else {
        console.log('✅ לא נמצאו ציונים בעייתיים בDB');
      }
      
      // סימולציה של הלוגיקה החדשה
      console.log('\n3️⃣ סימולציה של הלוגיקה החדשה:');
      
      if (finalExam.mergedAnswers) {
        // קבץ שאלות לפי תוכן
        const questionGroups = new Map();
        finalExam.mergedAnswers.forEach(answer => {
          const questionText = (answer.questionText || '').trim();
          if (!questionGroups.has(questionText)) {
            questionGroups.set(questionText, []);
          }
          questionGroups.get(questionText).push(answer);
        });
        
        let shouldBeFiltered = 0;
        let shouldBeShown = 0;
        
        questionGroups.forEach((duplicates, questionText) => {
          if (duplicates.length > 1) {
            console.log(`\n🔄 כפילות: "${questionText.substring(0, 60)}..."`);
            
            // מצא ציונים לכל עותק
            duplicates.forEach(answer => {
              const grade = grades.find(g => g.questionIndex === answer.questionIndex);
              if (grade) {
                const isProblematic = grade.maxScore === 1 && grade.score > 1;
                console.log(`   questionIndex ${answer.questionIndex}: ${grade.score}/${grade.maxScore} ${isProblematic ? '(יסונן)' : '(יוצג)'}`);
                
                if (isProblematic) {
                  shouldBeFiltered++;
                } else {
                  shouldBeShown++;
                }
              } else {
                console.log(`   questionIndex ${answer.questionIndex}: ללא ציון`);
              }
            });
          }
        });
        
        console.log(`\n📊 סיכום הלוגיקה:`);
        console.log(`   צריך להסתיר: ${shouldBeFiltered} ציונים בעייתיים`);
        console.log(`   צריך להציג: ${shouldBeShown} ציונים תקינים`);
      }
      
    } else {
      console.log('❌ לא נמצאה בחינה בDB');
    }
    
  } catch (error) {
    console.error('❌ שגיאה בבדיקת DB:', error.message);
  } finally {
    await client.close();
  }
  
  // 4. המלצה לפתרון
  console.log('\n💡 אבחון הבעיה:');
  console.log('='.repeat(40));
  console.log('🔍 אם עדיין רואים ציונים כמו 4/1, 6/1 או 3/1:');
  console.log('   1. יכול להיות שהשרת לא התעדכן');
  console.log('   2. יכול להיות שהלוגיקה לא עובדת כמו שצריך');
  console.log('   3. יכול להיות שיש ציונים בעייתיים אחרים');
  console.log('');
  console.log('🔧 פתרונות מיידיים:');
  console.log('   A. רענן את הדפדפן (Ctrl+F5)');
  console.log('   B. בדוק את קונסול הדפדפן לשגיאות');
  console.log('   C. ודא שהשרת התעדכן');
}

debugKarenRealtime();