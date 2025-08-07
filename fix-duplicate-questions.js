const { MongoClient } = require('mongodb');

async function fixDuplicateQuestions() {
  const dbUserName = process.env.dbUserName || "sql-admin";
  const dbPassword = process.env.dbPassword || "SMff5PqhhoVbX6z7";
  const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
  
  const client = new MongoClient(connectionString);
  
  try {
    console.log('🔧 מתקן את בעיית השאלות הכפולות...\n');
    
    await client.connect();
    const db = client.db('experiment');
    
    console.log('🎯 דוגמה: מיקה רוס - בחינה 6878a12b559dbb459f5eb4e3');
    console.log('='.repeat(60));
    
    const { ObjectId } = require('mongodb');
    const examId = '6878a12b559dbb459f5eb4e3';
    
    const finalExam = await db.collection('finalExams').findOne({
      _id: new ObjectId(examId)
    });
    
    if (!finalExam) {
      console.log('❌ לא נמצאה בחינה');
      return;
    }
    
    // זהה שאלות כפולות
    console.log('🔍 מחפש שאלות כפולות...');
    const questionGroups = {};
    
    finalExam.mergedAnswers.forEach((answer, index) => {
      const questionText = answer.questionText || '';
      const firstWords = questionText.substring(0, 50);
      
      if (!questionGroups[firstWords]) {
        questionGroups[firstWords] = [];
      }
      questionGroups[firstWords].push({
        questionIndex: answer.questionIndex,
        fullText: questionText,
        answer: answer.studentAnswer,
        originalIndex: index
      });
    });
    
    // הצג שאלות כפולות
    const duplicates = Object.keys(questionGroups).filter(key => questionGroups[key].length > 1);
    
    console.log(`📊 נמצאו ${duplicates.length} קבוצות של שאלות כפולות:`);
    
    duplicates.forEach((key, groupIndex) => {
      const group = questionGroups[key];
      console.log(`\n${groupIndex + 1}. "${key}..."`);
      group.forEach(item => {
        console.log(`   📍 questionIndex: ${item.questionIndex}`);
        
        // בדוק אם יש ציון לשאלה הזו
        const hasGrade = finalExam.review?.questionGrades?.find(qg => qg.questionIndex === item.questionIndex);
        if (hasGrade) {
          console.log(`      ✅ יש ציון: ${hasGrade.score}/${hasGrade.maxScore}`);
          console.log(`      💬 הערה: "${hasGrade.feedback || 'אין הערה'}"`);
        } else {
          console.log(`      ❌ אין ציון`);
        }
      });
    });
    
    // פתרון לדוגמה: מיקה רוס
    console.log('\n🔧 פתרון לדוגמה למיקה רוס:');
    console.log('-'.repeat(50));
    
    const efficiencyQuestions = questionGroups['בשאלה זו עליכם לחשב ולהציג את היעילות התפעולית'];
    if (efficiencyQuestions && efficiencyQuestions.length > 1) {
      console.log('🎯 שאלת היעילות התפעולית מופיעה פעמיים:');
      
      let questionWithGrade = null;
      let questionWithoutGrade = null;
      
      efficiencyQuestions.forEach(q => {
        const hasGrade = finalExam.review?.questionGrades?.find(qg => qg.questionIndex === q.questionIndex);
        if (hasGrade) {
          questionWithGrade = { ...q, grade: hasGrade };
          console.log(`   ✅ questionIndex ${q.questionIndex}: יש ציון (${hasGrade.score}/${hasGrade.maxScore})`);
        } else {
          questionWithoutGrade = q;
          console.log(`   ❌ questionIndex ${q.questionIndex}: אין ציון`);
        }
      });
      
      if (questionWithGrade && questionWithoutGrade) {
        console.log('\n💡 פתרון מוצע:');
        console.log(`   1. העתק את הציון מ-questionIndex ${questionWithGrade.questionIndex}`);
        console.log(`   2. למחק/איחוד עם questionIndex ${questionWithoutGrade.questionIndex}`);
        console.log(`   3. או: הוסף הערה ל-questionIndex ${questionWithoutGrade.questionIndex} למה הוא קיבל 0`);
        
        // אפשרות לתיקון אוטומטי
        console.log('\n🤖 תיקון אוטומטי אפשרי:');
        console.log(`   העתק ציון ${questionWithGrade.grade.score}/${questionWithGrade.grade.maxScore}`);
        console.log(`   מ-questionIndex ${questionWithGrade.questionIndex}`);
        console.log(`   אל questionIndex ${questionWithoutGrade.questionIndex}`);
      }
    }
    
    // בדיקה כוללת של כל הבחינות
    console.log('\n🔍 בדיקה כוללת של שאלות כפולות בכל הבחינות:');
    console.log('='.repeat(60));
    
    const allFinalExams = await db.collection('finalExams').find({
      mergedAnswers: { $exists: true, $ne: [] }
    }).toArray();
    
    let totalDuplicates = 0;
    let totalExamsWithDuplicates = 0;
    
    for (const exam of allFinalExams) {
      const examQuestionGroups = {};
      
      if (exam.mergedAnswers) {
        exam.mergedAnswers.forEach(answer => {
          const questionText = answer.questionText || '';
          const firstWords = questionText.substring(0, 50);
          
          if (!examQuestionGroups[firstWords]) {
            examQuestionGroups[firstWords] = [];
          }
          examQuestionGroups[firstWords].push(answer.questionIndex);
        });
        
        const examDuplicates = Object.keys(examQuestionGroups).filter(key => examQuestionGroups[key].length > 1);
        
        if (examDuplicates.length > 0) {
          totalExamsWithDuplicates++;
          totalDuplicates += examDuplicates.length;
          
          console.log(`📌 בחינה ${exam._id}: ${examDuplicates.length} שאלות כפולות`);
          examDuplicates.forEach(key => {
            const indices = examQuestionGroups[key];
            console.log(`   "${key}..." - questionIndices: ${indices.join(', ')}`);
          });
        }
      }
    }
    
    console.log(`\n📊 סיכום כולל:`);
    console.log(`   🎯 ${totalExamsWithDuplicates} בחינות עם שאלות כפולות`);
    console.log(`   📝 ${totalDuplicates} קבוצות של שאלות כפולות`);
    console.log(`   💡 זה מסביר את הבעיה של ציונים 0 ללא הערה!`);
    
    console.log('\n🏁 ניתוח השאלות הכפולות הושלם!');
    
  } catch (error) {
    console.error('❌ שגיאה בתיקון שאלות כפולות:', error);
  } finally {
    await client.close();
  }
}

fixDuplicateQuestions();