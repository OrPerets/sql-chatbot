const { MongoClient } = require('mongodb');

async function comprehensiveZeroScoresAnalysis() {
  // Use the same connection string as the mentor-server
  const dbUserName = process.env.dbUserName || "sql-admin";
  const dbPassword = process.env.dbPassword || "SMff5PqhhoVbX6z7";
  const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
  
  const client = new MongoClient(connectionString);
  
  try {
    console.log('🔍 מתחיל ניתוח מקיף של ציונים 0 ללא הערות...\n');
    console.log('📚 בודק את אותם נתונים ששימשו בעמוד "grade-by-question"\n');
    
    await client.connect();
    const db = client.db('experiment');
    
    let allCases = [];
    
    // בדיקה באוסף finalExams - הנתונים שמשמשים את grade-by-question
    console.log('📚 בודק finalExams collection (המקור של grade-by-question)...');
    const finalExamsResults = await db.collection('finalExams').find({
      'review.questionGrades': { $exists: true, $ne: [] }
    }).toArray();
    
    console.log(`נמצאו ${finalExamsResults.length} בחינות עם ציונים...`);
    
    // טעינת כל השאלות לצורך הצגת התוכן
    const questionsMap = new Map();
    const questions = await db.collection('questions').find({}).toArray();
    questions.forEach(q => {
      questionsMap.set(q.id, q);
    });
    
    console.log(`נטענו ${questions.length} שאלות מהמאגר...\n`);
    
    for (const exam of finalExamsResults) {
      if (!exam.review || !exam.review.questionGrades) continue;
      
      for (const qg of exam.review.questionGrades) {
        if (qg.score === 0) {
          // בדיקה אם אין הערה או שההערה ריקה
          const hasFeedback = qg.feedback && qg.feedback.trim() !== '';
          
          if (!hasFeedback) {
            // מצא את השאלה בתוכן המבחן
            let questionContent = 'שאלה לא נמצאה';
            let studentAnswer = 'תשובה לא נמצאה';
            
            // נסה למצוא את השאלה במergedAnswers
            if (exam.mergedAnswers) {
              const answerData = exam.mergedAnswers.find(ans => 
                ans.questionIndex === qg.questionIndex
              );
              if (answerData) {
                questionContent = answerData.questionText || answerData.question || 'טקסט השאלה לא זמין';
                studentAnswer = answerData.studentAnswer || answerData.answer || 'תשובת הסטודנט לא זמינה';
                
                // אם לא נמצא טקסט השאלה, נסה לחפש במאגר השאלות
                if (questionContent === 'טקסט השאלה לא זמין' && answerData.questionId) {
                  const questionFromDB = questionsMap.get(parseInt(answerData.questionId));
                  if (questionFromDB) {
                    questionContent = questionFromDB.question || questionFromDB.text || 'טקסט לא זמין';
                  }
                }
              }
            }
            
            allCases.push({
              source: 'finalExams',
              examId: exam._id.toString(),
              studentId: exam.studentId || 'לא ידוע',
              studentName: exam.studentName || 'שם לא ידוע',
              studentEmail: exam.studentEmail || 'מייל לא ידוע',
              questionIndex: qg.questionIndex,
              questionContent: questionContent,
              studentAnswer: studentAnswer,
              score: qg.score,
              maxScore: qg.maxScore,
              feedback: qg.feedback || 'undefined',
              gradedAt: qg.gradedAt,
              examMetadata: {
                totalScore: exam.review?.totalScore,
                maxScore: exam.review?.maxScore,
                isGraded: exam.review?.isGraded,
                examDate: exam.createdAt,
                examStatus: exam.status
              }
            });
          }
        }
      }
    }
    
    // מיון לפי examId ואז לפי questionIndex
    allCases.sort((a, b) => {
      if (a.examId !== b.examId) {
        return a.examId.localeCompare(b.examId);
      }
      return a.questionIndex - b.questionIndex;
    });
    
    console.log(`\n📋 רשימה מפורטת של ${allCases.length} מקרים:\n`);
    console.log('='.repeat(120));
    
    let currentExamId = null;
    let examCaseCount = 0;
    
    allCases.forEach((case_, index) => {
      // אם זה בחינה חדשה, הצג כותרת
      if (currentExamId !== case_.examId) {
        if (currentExamId !== null) {
          console.log(`   └── סה"כ ${examCaseCount} שאלות עם ציון 0 ללא הערה בבחינה זו\n`);
        }
        
        currentExamId = case_.examId;
        examCaseCount = 0;
        
        console.log(`🎯 בחינה: ${case_.examId}`);
        console.log(`   📊 מקור הנתונים: ${case_.source}`);
        if (case_.examMetadata && case_.examMetadata.examDate) {
          console.log(`   📅 תאריך בחינה: ${new Date(case_.examMetadata.examDate).toLocaleDateString('he-IL')}`);
        }
        if (case_.examMetadata) {
          console.log(`   🏆 ציון כללי: ${case_.examMetadata.totalScore}/${case_.examMetadata.maxScore}`);
          console.log(`   📊 סטטוס בחינה: ${case_.examMetadata.examStatus || 'לא ידוע'}`);
        }
        console.log('');
      }
      
      examCaseCount++;
      
      console.log(`   📌 שאלה ${case_.questionIndex}:`);
      console.log(`      👤 סטודנט: ${case_.studentName} (${case_.studentId})`);
      console.log(`      📧 מייל: ${case_.studentEmail}`);
      console.log(`      🎯 ציון: ${case_.score}/${case_.maxScore}`);
      console.log(`      💬 הערה: "${case_.feedback}"`);
      if (case_.gradedAt) {
        console.log(`      📅 תאריך דירוג: ${new Date(case_.gradedAt).toLocaleDateString('he-IL')}`);
      }
      console.log(`      ❓ תוכן השאלה:`);
      // הגבל את אורך השאלה לתצוגה נקייה
      const questionPreview = case_.questionContent.length > 150 
        ? case_.questionContent.substring(0, 150) + '...'
        : case_.questionContent;
      console.log(`         "${questionPreview}"`);
      
      console.log(`      ✍️ תשובת הסטודנט:`);
      // הגבל את אורך התשובה לתצוגה נקייה
      const answerPreview = case_.studentAnswer.length > 200 
        ? case_.studentAnswer.substring(0, 200) + '...'
        : case_.studentAnswer;
      console.log(`         "${answerPreview}"`);
      console.log('');
    });
    
    // הצגת הסיכום לבחינה האחרונה
    if (currentExamId !== null) {
      console.log(`   └── סה"כ ${examCaseCount} שאלות עם ציון 0 ללא הערה בבחינה זו\n`);
    }
    
    // סיכום לפי בחינות
    console.log('📈 סיכום לפי בחינות:');
    console.log('='.repeat(80));
    
    const examSummary = {};
    allCases.forEach(case_ => {
      if (!examSummary[case_.examId]) {
        examSummary[case_.examId] = {
          count: 0,
          questions: [],
          source: case_.source,
          students: new Set(),
          studentDetails: new Map()
        };
      }
      examSummary[case_.examId].count++;
      examSummary[case_.examId].questions.push(case_.questionIndex);
      examSummary[case_.examId].students.add(case_.studentId);
      examSummary[case_.examId].studentDetails.set(case_.studentId, {
        name: case_.studentName,
        email: case_.studentEmail
      });
    });
    
    Object.keys(examSummary).forEach(examId => {
      const summary = examSummary[examId];
      console.log(`🎯 ${examId}:`);
      console.log(`   📊 ${summary.count} מקרים`);
      console.log(`   📝 שאלות: ${[...new Set(summary.questions)].sort((a,b) => a-b).join(', ')}`);
      console.log(`   👥 ${summary.students.size} סטודנטים שונים:`);
      
      // הצג פרטי הסטודנטים
      summary.students.forEach(studentId => {
        const studentInfo = summary.studentDetails.get(studentId);
        console.log(`       - ${studentInfo.name} (${studentId}) - ${studentInfo.email}`);
      });
      
      console.log(`   💾 מקור: ${summary.source}`);
      console.log('');
    });
    
    // סטטיסטיקות כלליות
    console.log('📊 סטטיסטיקות כלליות:');
    console.log('='.repeat(60));
    console.log(`✅ הניתוח התבסס על אותם נתונים ששימשים את עמוד "grade-by-question"`);
    console.log(`📚 נבדקו רק בחינות מהאוסף finalExams עם ציונים מוגדרים`);
    console.log(`🔍 נמצאו ${allCases.length} מקרים של ציון 0 ללא הערה`);
    console.log(`🎯 המקרים התפרסו על פני ${Object.keys(examSummary).length} בחינות שונות`);
    
    const uniqueStudents = new Set(allCases.map(c => c.studentId));
    console.log(`👥 מעורבים ${uniqueStudents.size} סטודנטים שונים`);
    
    // המלצות
    console.log('\n💡 המלצות לטיפול:');
    console.log('='.repeat(60));
    if (allCases.length > 0) {
      console.log('⚠️  נמצאו מקרים של ציונים 0 ללא הערה מתמשכת');
      console.log('🔧 מומלץ לעבור על המקרים הללו בעמוד "grade-by-question" ולהוסיף הערות');
      console.log('📝 כדאי ליצור מדיניות שמחייבת הערה כאשר נותנים ציון 0');
      console.log('🎯 ניתן לטפל במקרים לפי בחינה - התחל מהבחינה עם הכי הרבה מקרים');
    } else {
      console.log('✅ לא נמצאו מקרים בעייתיים - כל ציוני ה-0 כוללים הערות');
    }
    
    console.log('\n🏁 ניתוח מקיף הושלם בהצלחה!');
    
  } catch (error) {
    console.error('❌ שגיאה בניתוח:', error);
  } finally {
    await client.close();
  }
}

// הרצה
comprehensiveZeroScoresAnalysis();