const { MongoClient } = require('mongodb');

async function debugKarenIssue() {
  console.log('🚨 בדיקה מהירה של בעיית קרן ריזנברג...\n');
  
  const dbUserName = process.env.dbUserName || "sql-admin";
  const dbPassword = process.env.dbPassword || "SMff5PqhhoVbX6z7";
  const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
  
  const client = new MongoClient(connectionString);
  
  try {
    await client.connect();
    const db = client.db('experiment');
    
    // חפש את קרן ריזנברג
    console.log('🔍 מחפש את קרן ריזנברג...');
    const karenExam = await db.collection('finalExams').findOne({
      studentName: { $regex: 'ריזנברג.*קרן|קרן.*ריזנברג', $options: 'i' }
    });
    
    if (!karenExam) {
      console.log('❌ לא נמצא מבחן לקרן ריזנברג');
      return;
    }
    
    console.log(`✅ נמצא מבחן: ${karenExam._id}`);
    console.log(`👤 שם מלא: ${karenExam.studentName}`);
    console.log(`📧 מייל: ${karenExam.studentEmail}\n`);
    
    // בדוק את הציונים הקיימים
    const grades = karenExam.review?.questionGrades || [];
    console.log(`📊 סה"כ ציונים: ${grades.length}`);
    
    // מצא שאלות עם 1 נקודה
    const onePointQuestions = grades.filter(grade => grade.maxScore === 1);
    console.log(`🎯 שאלות עם maxScore=1: ${onePointQuestions.length}\n`);
    
    if (onePointQuestions.length > 0) {
      console.log('🔍 שאלות עם 1 נקודה:');
      console.log('='.repeat(50));
      
      onePointQuestions.forEach((grade, index) => {
        console.log(`${index + 1}. questionIndex: ${grade.questionIndex}`);
        console.log(`   ציון: ${grade.score}/${grade.maxScore}`);
        console.log(`   הערה: "${grade.feedback || 'אין הערה'}"`);
        
        // מצא את השאלה המתאימה ב-mergedAnswers
        const relatedAnswer = karenExam.mergedAnswers?.find(answer => 
          answer.questionIndex === grade.questionIndex
        );
        
        if (relatedAnswer) {
          console.log(`   תוכן שאלה: "${(relatedAnswer.questionText || '').substring(0, 80)}..."`);
          
          // בדוק אם יש כפילויות של השאלה הזו
          const duplicates = karenExam.mergedAnswers.filter(answer => 
            answer.questionText && relatedAnswer.questionText && 
            answer.questionText.trim() === relatedAnswer.questionText.trim()
          );
          
          if (duplicates.length > 1) {
            console.log(`   🔄 יש ${duplicates.length} כפילויות לשאלה זו:`);
            duplicates.forEach(dup => {
              const dupGrade = grades.find(g => g.questionIndex === dup.questionIndex);
              console.log(`      questionIndex ${dup.questionIndex}: ${dupGrade ? `${dupGrade.score}/${dupGrade.maxScore}` : 'ללא ציון'}`);
            });
          }
        }
        console.log('');
      });
    }
    
    // בדוק אם יש שאלות עם maxScore גבוה יותר
    const higherPointQuestions = grades.filter(grade => grade.maxScore > 1);
    console.log(`📈 שאלות עם maxScore>1: ${higherPointQuestions.length}`);
    
    if (higherPointQuestions.length > 0) {
      console.log('\n🎯 דוגמאות שאלות עם ציונים גבוהים:');
      higherPointQuestions.slice(0, 3).forEach(grade => {
        console.log(`   questionIndex ${grade.questionIndex}: ${grade.score}/${grade.maxScore}`);
      });
    }
    
    // בדוק מה הייתה ההתנהגות הקודמת
    console.log('\n🔍 ניתוח: מה השתנה?');
    console.log('='.repeat(40));
    
    // סימולציה של הלוגיקה הישנה (רק התרחשות ראשונה)
    const questionGroups = new Map();
    if (karenExam.mergedAnswers) {
      karenExam.mergedAnswers.forEach(answer => {
        const questionText = (answer.questionText || '').trim();
        if (!questionGroups.has(questionText)) {
          questionGroups.set(questionText, []);
        }
        questionGroups.get(questionText).push(answer);
      });
    }
    
    let oldLogicWouldShow = 0;
    let newLogicWillShow = 0;
    
    questionGroups.forEach((duplicates, questionText) => {
      if (duplicates.length > 1) {
        // לוגיקה ישנה: ראשון מנצח
        const oldChoice = duplicates[0];
        const oldGrade = grades.find(g => g.questionIndex === oldChoice.questionIndex);
        
        // לוגיקה חדשה: ציון גבוה ביותר מנצח
        const duplicatesWithGrades = duplicates.map(dup => {
          const grade = grades.find(g => g.questionIndex === dup.questionIndex);
          return { ...dup, grade, score: grade?.score || 0, maxScore: grade?.maxScore || 0 };
        });
        
        duplicatesWithGrades.sort((a, b) => {
          if (!!a.grade !== !!b.grade) return !!b.grade ? 1 : -1;
          if (a.grade && b.grade) return b.score - a.score;
          return 0;
        });
        
        const newChoice = duplicatesWithGrades[0];
        
        if (oldGrade) oldLogicWouldShow++;
        if (newChoice.grade) newLogicWillShow++;
        
        if ((oldGrade?.maxScore || 0) !== (newChoice.grade?.maxScore || 0)) {
          console.log(`🔄 שינוי בשאלה: "${questionText.substring(0, 60)}..."`);
          console.log(`   ישן: questionIndex ${oldChoice.questionIndex} (${oldGrade ? `${oldGrade.score}/${oldGrade.maxScore}` : 'ללא ציון'})`);
          console.log(`   חדש: questionIndex ${newChoice.questionIndex} (${newChoice.grade ? `${newChoice.grade.score}/${newChoice.grade.maxScore}` : 'ללא ציון'})`);
        }
      }
    });
    
    console.log(`\n📊 סיכום השינויים:`);
    console.log(`   לוגיקה ישנה הייתה מציגה: ${oldLogicWouldShow} שאלות מדורגות`);
    console.log(`   לוגיקה חדשה תציג: ${newLogicWillShow} שאלות מדורגות`);
    
    // הצעה לפתרון מהיר
    console.log('\n💡 פתרון מהיר:');
    console.log('='.repeat(30));
    
    if (onePointQuestions.length > 0) {
      console.log('🎯 הבעיה: הלוגיקה החדשה חושפת שאלות עם maxScore=1 שהיו מוסתרות');
      console.log('🔧 פתרונות:');
      console.log('   1. החזר את הלוגיקה הישנה (מהיר)');
      console.log('   2. תקן את maxScore לשאלות עם 1 נקודה');
      console.log('   3. הסתר שאלות עם maxScore=1 מהתצוגה');
    } else {
      console.log('✅ נראה תקין - לא נמצאו שאלות בעייתיות');
    }
    
  } catch (error) {
    console.error('❌ שגיאה:', error.message);
  } finally {
    await client.close();
  }
}

debugKarenIssue();