const { MongoClient } = require('mongodb');

async function checkSpecificGradeDifference() {
  console.log('🔍 בודק את ההבדל הספציפי עבור השאלה של קרשטיין בר...\n');
  
  const examId = '6878a0a3dd197423090e00d6';
  const questionSearchText = 'כתוב שאילתה שמחזירה את מספר הטייסים הפעילים בכל בסיס';
  
  const dbUserName = process.env.dbUserName || "sql-admin";
  const dbPassword = process.env.dbPassword || "SMff5PqhhoVbX6z7";
  const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
  
  const client = new MongoClient(connectionString);
  
  try {
    await client.connect();
    const db = client.db('experiment');
    const { ObjectId } = require('mongodb');
    
    console.log('1️⃣ מה exam-grading אמור להציג (לפי הלוגיקה החדשה):');
    console.log('='.repeat(60));
    
    const finalExam = await db.collection('finalExams').findOne({
      _id: new ObjectId(examId)
    });
    
    if (finalExam) {
      // השאלות התואמות
      const matchingQuestions = finalExam.mergedAnswers?.filter(answer => 
        answer.questionText && answer.questionText.includes(questionSearchText)
      ) || [];
      
      console.log(`🎯 נמצאו ${matchingQuestions.length} שאלות תואמות בmergedAnswers`);
      
      // הלוגיקה החדשה - עדיפות לשאלה עם ציון
      let chosenQuestion = matchingQuestions[0]; // fallback
      for (const question of matchingQuestions) {
        const hasGrade = finalExam.review?.questionGrades?.some(qg => qg.questionIndex === question.questionIndex);
        if (hasGrade) {
          chosenQuestion = question;
          console.log(`✅ exam-grading יבחר: questionIndex ${chosenQuestion.questionIndex}`);
          break;
        }
      }
      
      const chosenGrade = finalExam.review?.questionGrades?.find(qg => qg.questionIndex === chosenQuestion.questionIndex);
      if (chosenGrade) {
        console.log(`📊 ציון שיוצג בexam-grading: ${chosenGrade.score}/${chosenGrade.maxScore}`);
        console.log(`💬 הערה שתוצג בexam-grading: "${chosenGrade.feedback || 'אין הערה'}"`);
      } else {
        console.log(`❌ אין ציון - זו הבעיה!`);
      }
    }
    
    console.log('\n2️⃣ מה grade-by-question אמור להציג:');
    console.log('='.repeat(50));
    
    // grade-by-question מתבסס על השאלות מה-questions collection
    // ועל הנתונים מה-finalExams עבור התשובות והציונים
    
    // בדוק כל השאלות הקיימות ב-questions collection
    const allQuestions = await db.collection('questions').find({}).toArray();
    console.log(`🔍 סה"כ ${allQuestions.length} שאלות ב-questions collection`);
    
    // חפש שאלות עם תוכן דומה
    const relevantQuestions = allQuestions.filter(q => 
      q.questionText && q.questionText.includes('טייסים') && q.questionText.includes('בסיס')
    );
    
    console.log(`🎯 נמצאו ${relevantQuestions.length} שאלות רלוונטיות:`);
    
    for (const question of relevantQuestions) {
      console.log(`\n📝 שאלה ID: ${question._id}`);
      console.log(`   תוכן: "${question.questionText?.substring(0, 100)}..."`);
      
      // בדוק אם יש תשובה של קרשטיין לשאלה הזו
      const answerForThisQuestion = finalExam.mergedAnswers?.find(answer => 
        answer.questionId === question._id.toString()
      );
      
      if (answerForThisQuestion) {
        console.log(`   ✅ קרשטיין ענתה על השאלה הזו (questionIndex: ${answerForThisQuestion.questionIndex})`);
        
        const gradeForThisAnswer = finalExam.review?.questionGrades?.find(qg => 
          qg.questionIndex === answerForThisQuestion.questionIndex
        );
        
        if (gradeForThisAnswer) {
          console.log(`   📊 ציון בgrade-by-question: ${gradeForThisAnswer.score}/${gradeForThisAnswer.maxScore}`);
          console.log(`   💬 הערה בgrade-by-question: "${gradeForThisAnswer.feedback || 'אין הערה'}"`);
        } else {
          console.log(`   ❌ אין ציון לתשובה זו`);
        }
      } else {
        console.log(`   ❌ קרשטיין לא ענתה על השאלה הזו`);
      }
    }
    
    console.log('\n3️⃣ בדיקה מעמיקה - האם יש מספר questionIndex-ים לאותה שאלה?');
    console.log('='.repeat(70));
    
    // בדוק אם יש questionId זהה עם questionIndex שונה
    if (finalExam.mergedAnswers) {
      const questionIdGroups = new Map();
      
      finalExam.mergedAnswers.forEach(answer => {
        if (answer.questionId) {
          if (!questionIdGroups.has(answer.questionId)) {
            questionIdGroups.set(answer.questionId, []);
          }
          questionIdGroups.get(answer.questionId).push(answer);
        }
      });
      
      let foundMultiple = false;
      for (const [questionId, answers] of questionIdGroups.entries()) {
        if (answers.length > 1) {
          // בדוק אם מדובר בשאלה שלנו
          const isOurQuestion = answers.some(answer => 
            answer.questionText && answer.questionText.includes(questionSearchText)
          );
          
          if (isOurQuestion) {
            foundMultiple = true;
            console.log(`🔄 נמצא questionId ${questionId} עם ${answers.length} תשובות שונות:`);
            
            answers.forEach(answer => {
              console.log(`   questionIndex ${answer.questionIndex}:`);
              const grade = finalExam.review?.questionGrades?.find(qg => qg.questionIndex === answer.questionIndex);
              if (grade) {
                console.log(`      ✅ ציון: ${grade.score}/${grade.maxScore} - "${grade.feedback || 'אין הערה'}"`);
              } else {
                console.log(`      ❌ אין ציון`);
              }
            });
          }
        }
      }
      
      if (!foundMultiple) {
        console.log('✅ לא נמצא questionId עם מספר questionIndex-ים');
      }
    }
    
    console.log('\n💡 סיכום:');
    console.log('='.repeat(30));
    console.log('עכשיו אני צריך לדעת מה בדיוק את רואה בgrade-by-question:');
    console.log('❓ איזה ציון את רואה שם עבור השאלה הזו?');
    console.log('❓ האם זה ציון שונה מ-0/8?');
    
  } catch (error) {
    console.error('❌ שגיאה:', error.message);
  } finally {
    await client.close();
  }
}

checkSpecificGradeDifference();