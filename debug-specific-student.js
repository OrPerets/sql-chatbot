const { MongoClient } = require('mongodb');

async function debugSpecificStudent() {
  const dbUserName = process.env.dbUserName || "sql-admin";
  const dbPassword = process.env.dbPassword || "SMff5PqhhoVbX6z7";
  const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
  
  const client = new MongoClient(connectionString);
  
  try {
    console.log('🔍 בודק את הבעיה של מיקה רוס - מקרה הבדיקה...\n');
    
    await client.connect();
    const db = client.db('experiment');
    
    const examId = '6878a12b559dbb459f5eb4e3';
    const studentName = 'מיקה רוס';
    
    console.log(`🎯 בחינה: ${examId}`);
    console.log(`👤 סטודנטית: ${studentName}`);
    console.log(`❓ שאלה: השאלה על יעילות תפעולית של טייסות\n`);
    
    // 1. בדיקה ב-finalExams (מה שgrade-by-question אמור לרואה)
    console.log('📚 בדיקה ב-finalExams collection:');
    console.log('='.repeat(60));
    
    const { ObjectId } = require('mongodb');
    const finalExam = await db.collection('finalExams').findOne({
      _id: new ObjectId(examId)
    });
    
    if (finalExam) {
      console.log(`✅ נמצאה בחינה ב-finalExams:`);
      console.log(`   👤 סטודנט: ${finalExam.studentName || 'לא ידוע'}`);
      console.log(`   📧 מייל: ${finalExam.studentEmail || 'לא ידוע'}`);
      console.log(`   📊 סטטוס: ${finalExam.status || 'לא ידוע'}`);
      
      // בדיקת mergedAnswers
      if (finalExam.mergedAnswers) {
        console.log(`\n📝 mergedAnswers (${finalExam.mergedAnswers.length} תשובות):`);
        finalExam.mergedAnswers.forEach((answer, index) => {
          const questionPreview = answer.questionText ? 
            answer.questionText.substring(0, 80) + '...' : 
            'אין טקסט שאלה';
          console.log(`   ${index}: ${questionPreview}`);
          console.log(`      תשובה: ${(answer.studentAnswer || '').substring(0, 50)}...`);
        });
      }
      
      // בדיקת review.questionGrades
      if (finalExam.review && finalExam.review.questionGrades) {
        console.log(`\n🎯 review.questionGrades (${finalExam.review.questionGrades.length} ציונים):`);
        finalExam.review.questionGrades.forEach((grade, index) => {
          console.log(`   שאלה ${grade.questionIndex}: ${grade.score}/${grade.maxScore}`);
          console.log(`      הערה: "${grade.feedback || 'אין הערה'}"`);
        });
      } else {
        console.log('\n❌ אין review.questionGrades ב-finalExams');
      }
    } else {
      console.log('❌ לא נמצאה בחינה ב-finalExams');
    }
    
    // 2. בדיקה ב-examGrades (מה שexam-grading אמור לראות)
    console.log('\n📚 בדיקה ב-examGrades collection:');
    console.log('='.repeat(60));
    
    const examGrade = await db.collection('examGrades').findOne({
      examId: examId
    });
    
    if (examGrade) {
      console.log(`✅ נמצא ציון ב-examGrades:`);
      console.log(`   📊 סה"כ ציון: ${examGrade.totalScore || 'לא ידוע'}`);
      console.log(`   📊 ציון מקסימלי: ${examGrade.maxScore || 'לא ידוע'}`);
      
      if (examGrade.questionGrades) {
        console.log(`\n🎯 questionGrades (${examGrade.questionGrades.length} ציונים):`);
        examGrade.questionGrades.forEach((grade, index) => {
          console.log(`   שאלה ${grade.questionIndex}: ${grade.score}/${grade.maxScore}`);
          console.log(`      הערה: "${grade.feedback || 'אין הערה'}"`);
        });
      } else {
        console.log('\n❌ אין questionGrades ב-examGrades');
      }
    } else {
      console.log('❌ לא נמצא ציון ב-examGrades');
    }
    
    // 3. בדיקה איך grade-by-question מקבל את הנתונים
    console.log('\n🔍 בדיקה איך grade-by-question מקבל נתונים:');
    console.log('='.repeat(60));
    
    // grade-by-question משתמש ב-questions-optimized ו-answers-optimized
    // בואו נבדוק איך הוא מוצא את התשובות של מיקה רוס
    
    // חפש בכל finalExams תשובות עם השאלה הזו
    const questionContent = 'בשאלה זו עליכם לחשב ולהציג את היעילות התפעולית';
    
    const allFinalExamsWithAnswers = await db.collection('finalExams').find({
      mergedAnswers: { $exists: true, $ne: [] }
    }).toArray();
    
    console.log(`🔍 מחפש תשובות לשאלה זו בכל finalExams...`);
    
    let foundAnswers = [];
    allFinalExamsWithAnswers.forEach(exam => {
      if (exam.mergedAnswers) {
        exam.mergedAnswers.forEach((answer, answerIndex) => {
          if (answer.questionText && answer.questionText.includes(questionContent)) {
            foundAnswers.push({
              examId: exam._id.toString(),
              studentName: exam.studentName,
              studentEmail: exam.studentEmail,
              questionIndex: answer.questionIndex,
              studentAnswer: answer.studentAnswer,
              questionText: answer.questionText,
              // חפש ציון בreview
              grade: exam.review?.questionGrades?.find(qg => qg.questionIndex === answer.questionIndex)
            });
          }
        });
      }
    });
    
    console.log(`📊 נמצאו ${foundAnswers.length} תשובות לשאלה זו:`);
    foundAnswers.forEach((answer, index) => {
      console.log(`\n${index + 1}. ${answer.studentName} (${answer.examId}):`);
      console.log(`   📝 תשובה: ${(answer.studentAnswer || '').substring(0, 100)}...`);
      if (answer.grade) {
        console.log(`   🎯 ציון: ${answer.grade.score}/${answer.grade.maxScore}`);
        console.log(`   💬 הערה: "${answer.grade.feedback || 'אין הערה'}"`);
      } else {
        console.log(`   ❌ אין ציון בreview.questionGrades`);
      }
    });
    
    // 4. בדיקה ספציפית למיקה רוס
    console.log('\n🎯 בדיקה ספציפית למיקה רוס:');
    console.log('='.repeat(50));
    
    const micahAnswer = foundAnswers.find(answer => 
      answer.studentName && answer.studentName.includes('מיקה')
    );
    
    if (micahAnswer) {
      console.log(`✅ נמצאה תשובה של מיקה רוס:`);
      console.log(`   🆔 examId: ${micahAnswer.examId}`);
      console.log(`   📍 questionIndex: ${micahAnswer.questionIndex}`);
      console.log(`   📝 תשובה: ${(micahAnswer.studentAnswer || '').substring(0, 150)}...`);
      
      if (micahAnswer.grade) {
        console.log(`   ✅ יש ציון ב-finalExams.review:`);
        console.log(`      🎯 ציון: ${micahAnswer.grade.score}/${micahAnswer.grade.maxScore}`);
        console.log(`      💬 הערה: "${micahAnswer.grade.feedback || 'אין הערה'}"`);
        console.log(`      📅 תאריך: ${micahAnswer.grade.gradedAt || 'לא ידוע'}`);
      } else {
        console.log(`   ❌ אין ציון ב-finalExams.review`);
      }
      
      // בדוק אם יש ציון ב-examGrades לאותה שאלה
      const examGradeForMicah = await db.collection('examGrades').findOne({
        examId: micahAnswer.examId
      });
      
      if (examGradeForMicah && examGradeForMicah.questionGrades) {
        const questionGradeInExamGrades = examGradeForMicah.questionGrades.find(qg => 
          qg.questionIndex === micahAnswer.questionIndex
        );
        
        if (questionGradeInExamGrades) {
          console.log(`   📚 ציון ב-examGrades:`);
          console.log(`      🎯 ציון: ${questionGradeInExamGrades.score}/${questionGradeInExamGrades.maxScore}`);
          console.log(`      💬 הערה: "${questionGradeInExamGrades.feedback || 'אין הערה'}"`);
          
          // השווה בין שני המקורות
          if (micahAnswer.grade) {
            const finalExamScore = micahAnswer.grade.score;
            const examGradeScore = questionGradeInExamGrades.score;
            const finalExamFeedback = micahAnswer.grade.feedback || '';
            const examGradeFeedback = questionGradeInExamGrades.feedback || '';
            
            console.log(`\n🔍 השוואה בין מקורות:`);
            if (finalExamScore !== examGradeScore) {
              console.log(`   ⚠️  ציונים שונים: finalExams(${finalExamScore}) vs examGrades(${examGradeScore})`);
            } else {
              console.log(`   ✅ ציונים זהים: ${finalExamScore}`);
            }
            
            if (finalExamFeedback !== examGradeFeedback) {
              console.log(`   ⚠️  הערות שונות:`);
              console.log(`      finalExams: "${finalExamFeedback}"`);
              console.log(`      examGrades: "${examGradeFeedback}"`);
            } else {
              console.log(`   ✅ הערות זהות`);
            }
          }
        } else {
          console.log(`   ❌ אין ציון לשאלה זו ב-examGrades`);
        }
      } else {
        console.log(`   ❌ אין examGrades כלל לבחינה זו`);
      }
    } else {
      console.log('❌ לא נמצאה תשובה של מיקה רוס לשאלה זו');
    }
    
    // 5. סיכום הממצאים
    console.log('\n🧐 ניתוח הבעיה:');
    console.log('='.repeat(50));
    
    if (micahAnswer && micahAnswer.grade && examGrade) {
      console.log('🎯 הבעיה נמצאה! בחינה יש נתונים בשני המקורות:');
      console.log('   ✅ grade-by-question רואה נתונים מ-finalExams.review');
      console.log('   ❌ exam-grading רואה נתונים מ-examGrades');
      console.log('   🚨 הנתונים לא מסונכרנים!');
      
      console.log('\n💡 פתרון:');
      console.log('   1. עדכון exam-grading להשתמש ב-unified-grade-sync ✅ (כבר נעשה)');
      console.log('   2. סנכרון הנתונים הקיימים של מיקה רוס');
      console.log('   3. וידוא שכל הבחינות מסונכרנות');
    } else {
      console.log('🤔 הבעיה מורכבת יותר - נתונים חסרים או לא נמצאו');
    }
    
    console.log('\n🏁 בדיקת מיקה רוס הושלמה!');
    
  } catch (error) {
    console.error('❌ שגיאה בבדיקת מיקה רוס:', error);
  } finally {
    await client.close();
  }
}

debugSpecificStudent();