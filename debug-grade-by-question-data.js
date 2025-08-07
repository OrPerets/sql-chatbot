const { MongoClient } = require('mongodb');

async function debugGradeByQuestionData() {
  console.log('🔍 בודק מה grade-by-question רואה עבור קרשטיין בר...\n');
  
  const examId = '6878a0a3dd197423090e00d6';
  const questionSearchText = 'כתוב שאילתה שמחזירה את מספר הטייסים הפעילים בכל בסיס';
  const SERVER_BASE = 'https://mentor-server-theta.vercel.app';
  
  try {
    // סימולציה של הקריאות ש-grade-by-question עושה
    console.log('🎯 בודק את API calls של grade-by-question...\n');
    
    // 1. בדיקה של questions API
    console.log('1️⃣ קריאה ל-/api/admin/questions-optimized');
    const questionsResponse = await fetch(`${SERVER_BASE}/api/admin/questions-optimized`);
    
    if (questionsResponse.ok) {
      const questionsData = await questionsResponse.json();
      console.log(`✅ מקבל ${questionsData.questions?.length || 0} שאלות`);
      
      // חפש את השאלה הספציפית
      const matchingQuestion = questionsData.questions?.find(q => 
        q.questionText && q.questionText.includes(questionSearchText)
      );
      
      if (matchingQuestion) {
        console.log(`🎯 נמצאה שאלה: ${matchingQuestion.id}`);
        console.log(`📝 תוכן: "${matchingQuestion.questionText.substring(0, 80)}..."`);
        
        // 2. בדיקה של answers עבור השאלה הזו
        console.log(`\n2️⃣ קריאה ל-/api/admin/question/${matchingQuestion.id}/answers-optimized`);
        const answersResponse = await fetch(`${SERVER_BASE}/api/admin/question/${matchingQuestion.id}/answers-optimized`);
        
        if (answersResponse.ok) {
          const answersData = await answersResponse.json();
          console.log(`✅ מקבל ${answersData.answers?.length || 0} תשובות`);
          
          // חפש את התשובה של קרשטיין בר
          const karshteinAnswer = answersData.answers?.find(answer => 
            answer.examId === examId
          );
          
          if (karshteinAnswer) {
            console.log(`\n🎯 תשובת קרשטיין בר נמצאה:`);
            console.log(`   📝 examId: ${karshteinAnswer.examId}`);
            console.log(`   📊 questionIndex: ${karshteinAnswer.questionIndex}`);
            console.log(`   📤 תשובה: "${karshteinAnswer.studentAnswer?.substring(0, 80)}..."`);
            console.log(`   👤 סטודנט: ${karshteinAnswer.studentName}`);
            
            if (karshteinAnswer.currentGrade !== undefined) {
              console.log(`   ✅ ציון ב-grade-by-question: ${karshteinAnswer.currentGrade}/${karshteinAnswer.maxScore}`);
              console.log(`   💬 הערה ב-grade-by-question: "${karshteinAnswer.feedback || 'אין הערה'}"`);
            } else {
              console.log(`   ❌ אין ציון ב-grade-by-question`);
            }
          } else {
            console.log(`❌ לא נמצאה תשובה של קרשטיין בר עבור שאלה זו`);
          }
        } else {
          console.log(`❌ שגיאה בקריאת answers: ${answersResponse.status}`);
        }
      } else {
        console.log(`❌ לא נמצאה השאלה ב-questions API`);
        
        // הראה כמה שאלות לדוגמא
        console.log(`\n📝 דוגמאות שאלות מה-API:`);
        questionsData.questions?.slice(0, 5).forEach((q, index) => {
          console.log(`   ${index + 1}. "${q.questionText?.substring(0, 80)}..."`);
        });
      }
    } else {
      console.log(`❌ שגיאה בקריאת questions: ${questionsResponse.status}`);
    }
    
  } catch (error) {
    console.error('❌ שגיאה בבדיקת APIs:', error.message);
  }
  
  // 3. בדיקה ישירה בDB של מה ש-grade-by-question צריך לראות
  console.log('\n3️⃣ בדיקה ישירה בDB - מה grade-by-question אמור לראות:');
  console.log('='.repeat(60));
  
  const dbUserName = process.env.dbUserName || "sql-admin";
  const dbPassword = process.env.dbPassword || "SMff5PqhhoVbX6z7";
  const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
  
  const client = new MongoClient(connectionString);
  
  try {
    await client.connect();
    const db = client.db('experiment');
    const { ObjectId } = require('mongodb');
    
    // חפש שאלה עם התוכן הזה
    const questionsWithMatchingContent = await db.collection('questions').find({
      questionText: { $regex: questionSearchText, $options: 'i' }
    }).toArray();
    
    console.log(`🔍 נמצאו ${questionsWithMatchingContent.length} שאלות ב-collection questions עם תוכן דומה:`);
    
    for (const question of questionsWithMatchingContent) {
      console.log(`\n📝 שאלה ID: ${question._id}`);
      console.log(`   תוכן: "${question.questionText?.substring(0, 80)}..."`);
      
      // חפש תשובות לשאלה הזו
      const finalExam = await db.collection('finalExams').findOne({
        _id: new ObjectId(examId),
        'mergedAnswers.questionId': question._id.toString()
      });
      
      if (finalExam) {
        const relevantAnswers = finalExam.mergedAnswers.filter(answer => 
          answer.questionId === question._id.toString()
        );
        
        console.log(`   🎯 נמצאו ${relevantAnswers.length} תשובות מקרשטיין לשאלה זו:`);
        relevantAnswers.forEach(answer => {
          console.log(`      questionIndex: ${answer.questionIndex}`);
          
          const grade = finalExam.review?.questionGrades?.find(qg => qg.questionIndex === answer.questionIndex);
          if (grade) {
            console.log(`      ✅ ציון: ${grade.score}/${grade.maxScore}`);
            console.log(`      💬 הערה: "${grade.feedback || 'אין הערה'}"`);
          } else {
            console.log(`      ❌ אין ציון`);
          }
        });
      } else {
        console.log(`   ❌ לא נמצאו תשובות לשאלה זו מקרשטיין`);
      }
    }
    
  } catch (error) {
    console.error('❌ שגיאה בבדיקת DB:', error.message);
  } finally {
    await client.close();
  }
}

debugGradeByQuestionData();