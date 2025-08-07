const { MongoClient } = require('mongodb');

async function debugKarshteinSpecificQuestion() {
  console.log('🔍 בודק בדיוק את השאלה הספציפית של קרשטיין בר...\n');
  
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
      console.log('❌ לא נמצאה בחינה');
      return;
    }
    
    console.log('✅ נמצאה בחינה');
    console.log(`👤 סטודנט: ${finalExam.studentName}`);
    console.log(`📧 מייל: ${finalExam.studentEmail}`);
    console.log(`📝 סה"כ תשובות: ${finalExam.mergedAnswers?.length || 0}\n`);
    
    // חפש את השאלה הספציפית
    const matchingQuestions = finalExam.mergedAnswers?.filter(answer => 
      answer.questionText && answer.questionText.includes(questionSearchText)
    ) || [];
    
    console.log(`🎯 נמצאו ${matchingQuestions.length} שאלות תואמות:\n`);
    
    if (matchingQuestions.length === 0) {
      console.log('❌ לא נמצאו שאלות תואמות');
      return;
    }
    
    // הצג פרטים מלאים על כל שאלה תואמת
    matchingQuestions.forEach((q, index) => {
      console.log(`${index + 1}. 🔍 questionIndex: ${q.questionIndex}`);
      console.log(`   📝 שאלה מלאה: "${q.questionText}"`);
      console.log(`   📤 תשובת סטודנט: "${q.studentAnswer || 'אין תשובה'}"`);
      
      // חפש ציון עבור questionIndex זה
      const gradeForQuestion = finalExam.review?.questionGrades?.find(qg => qg.questionIndex === q.questionIndex);
      if (gradeForQuestion) {
        console.log(`   ✅ יש ציון: ${gradeForQuestion.score}/${gradeForQuestion.maxScore}`);
        console.log(`   💬 הערה: "${gradeForQuestion.feedback || 'אין הערה'}"`);
      } else {
        console.log(`   ❌ אין ציון עבור questionIndex ${q.questionIndex}`);
      }
      console.log('');
    });
    
    // בדוק את כל הציונים הקיימים
    console.log('📊 כל הציונים הקיימים בבחינה:');
    console.log('='.repeat(50));
    if (finalExam.review?.questionGrades) {
      finalExam.review.questionGrades.forEach(grade => {
        console.log(`   questionIndex ${grade.questionIndex}: ${grade.score}/${grade.maxScore} - "${grade.feedback || 'אין הערה'}"`);
      });
    } else {
      console.log('   ❌ אין ציונים בכלל');
    }
    
    // סימולציה של הלוגיקה החדשה
    console.log('\n🧪 סימולציה של הלוגיקה החדשה:');
    console.log('='.repeat(50));
    
    // קבץ לפי תוכן שאלה
    const questionGroups = new Map();
    finalExam.mergedAnswers.forEach(answer => {
      const questionText = (answer.questionText || '').trim();
      if (!questionGroups.has(questionText)) {
        questionGroups.set(questionText, []);
      }
      questionGroups.get(questionText).push(answer);
    });
    
    // מצא את הקבוצה עם השאלה שלנו
    const targetGroup = Array.from(questionGroups.entries()).find(([text, answers]) => 
      text.includes(questionSearchText)
    );
    
    if (targetGroup) {
      const [questionText, duplicates] = targetGroup;
      console.log(`🔄 קבוצת שאלות זהות: ${duplicates.length} עותקים`);
      console.log(`📝 תוכן: "${questionText.substring(0, 80)}..."`);
      
      duplicates.forEach((dup, index) => {
        const hasGrade = finalExam.review?.questionGrades?.some(qg => qg.questionIndex === dup.questionIndex);
        const grade = finalExam.review?.questionGrades?.find(qg => qg.questionIndex === dup.questionIndex);
        
        console.log(`   ${index + 1}. questionIndex ${dup.questionIndex}: ${hasGrade ? '✅ עם ציון' : '❌ ללא ציון'}`);
        if (grade) {
          console.log(`      ציון: ${grade.score}/${grade.maxScore}`);
          console.log(`      הערה: "${grade.feedback || 'אין הערה'}"`);
        }
      });
      
      // בחר את הטוב ביותר
      let bestCandidate = duplicates[0];
      for (const duplicate of duplicates) {
        const hasExistingGrade = finalExam.review?.questionGrades?.some(grade => 
          grade.questionIndex === duplicate.questionIndex
        );
        if (hasExistingGrade) {
          bestCandidate = duplicate;
          break;
        }
      }
      
      console.log(`\n🎯 הלוגיקה החדשה תבחר: questionIndex ${bestCandidate.questionIndex}`);
      const chosenGrade = finalExam.review?.questionGrades?.find(qg => qg.questionIndex === bestCandidate.questionIndex);
      if (chosenGrade) {
        console.log(`✅ יוצג בexam-grading: ${chosenGrade.score}/${chosenGrade.maxScore} - "${chosenGrade.feedback || 'אין הערה'}"`);
      } else {
        console.log(`❌ אין ציון - זו הבעיה!`);
      }
    }
    
    // בדוק מה קורה ב-grade-by-question
    console.log('\n🎯 מה קורה ב-grade-by-question:');
    console.log('='.repeat(40));
    console.log('grade-by-question מחפש שאלה עם תוכן זהה ומוצא גרסה עם ציון...');
    
    // הראה גם מה קורה ב-examGrades
    const examGrades = await db.collection('examGrades').findOne({
      examId: examId
    });
    
    if (examGrades) {
      console.log(`\n📊 נתונים מ-examGrades collection:`);
      examGrades.questionGrades?.forEach(grade => {
        if (grade.questionIndex === 7 || grade.questionIndex === 8 || grade.questionIndex === 9) {
          console.log(`   questionIndex ${grade.questionIndex}: ${grade.score}/${grade.maxScore} - "${grade.feedback || 'אין הערה'}"`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ שגיאה:', error.message);
  } finally {
    await client.close();
  }
}

debugKarshteinSpecificQuestion();