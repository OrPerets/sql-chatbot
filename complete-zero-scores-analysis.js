const { MongoClient } = require('mongodb');

async function completeZeroScoresAnalysis() {
  // Use the same connection string as the mentor-server
  const dbUserName = process.env.dbUserName || "sql-admin";
  const dbPassword = process.env.dbPassword || "SMff5PqhhoVbX6z7";
  const connectionString = `mongodb+srv://${dbUserName}:${dbPassword}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;
  
  const client = new MongoClient(connectionString);
  
  try {
    console.log('🔍 מתחיל ניתוח מלא של כל מקורות הנתונים שמשמשים את exam-grading...\n');
    
    await client.connect();
    const db = client.db('experiment');
    
    let allCases = [];
    
    // טעינת כל השאלות לצורך הצגת התוכן
    const questionsMap = new Map();
    const questions = await db.collection('questions').find({}).toArray();
    questions.forEach(q => {
      questionsMap.set(q.id, q);
    });
    
    console.log(`נטענו ${questions.length} שאלות מהמאגר...\n`);
    
    // 1. בדיקה באוסף finalExams - המקור העיקרי של exam-grading
    console.log('📚 בודק finalExams collection (מקור עיקרי)...');
    const finalExamsResults = await db.collection('finalExams').find({
      'review.questionGrades': { $exists: true, $ne: [] }
    }).toArray();
    
    console.log(`נמצאו ${finalExamsResults.length} finalExams עם ציונים...`);
    
    for (const exam of finalExamsResults) {
      if (!exam.review || !exam.review.questionGrades) continue;
      
      for (const qg of exam.review.questionGrades) {
        if (qg.score === 0) {
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
              source: 'finalExams.review',
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
    
    // 2. בדיקה באוסף examGrades - מקור נוסף לנתונים
    console.log('\n📚 בודק examGrades collection (מקור משני)...');
    const examGradesResults = await db.collection('examGrades').find({
      questionGrades: { $exists: true, $ne: [] }
    }).toArray();
    
    console.log(`נמצאו ${examGradesResults.length} examGrades עם ציונים...`);
    
    for (const grade of examGradesResults) {
      if (!grade.questionGrades) continue;
      
      for (const qg of grade.questionGrades) {
        if (qg.score === 0) {
          const hasFeedback = qg.feedback && qg.feedback.trim() !== '';
          
          if (!hasFeedback) {
            // נסה למצוא פרטים נוספים על הבחינה והסטודנט
            let studentInfo = 'לא ידוע';
            let studentEmail = 'לא ידוע';
            let examMetadata = null;
            
            // חפש בfinalExams לפי examId
            const relatedFinalExam = await db.collection('finalExams').findOne({
              _id: grade.examId
            });
            
            if (relatedFinalExam) {
              studentInfo = relatedFinalExam.studentName || relatedFinalExam.studentId || 'לא ידוע';
              studentEmail = relatedFinalExam.studentEmail || 'לא ידוע';
              examMetadata = {
                totalScore: relatedFinalExam.review?.totalScore,
                maxScore: relatedFinalExam.review?.maxScore,
                examDate: relatedFinalExam.createdAt,
                examStatus: relatedFinalExam.status
              };
            }
            
            allCases.push({
              source: 'examGrades',
              examId: grade.examId?.toString() || 'לא ידוע',
              studentId: grade.studentId || studentInfo,
              studentName: studentInfo,
              studentEmail: studentEmail,
              questionIndex: qg.questionIndex,
              questionContent: 'יש לבדוק ברשומת הבחינה',
              studentAnswer: 'יש לבדוק ברשומת הבחינה',
              score: qg.score,
              maxScore: qg.maxScore,
              feedback: qg.feedback || 'undefined',
              gradedAt: qg.gradedAt,
              examMetadata: examMetadata
            });
          }
        }
      }
    }
    
    // 3. בדיקה באוסף examSessions - במקרה שיש שם נתונים נוספים
    console.log('\n📚 בודק examSessions collection (למקרה נתונים נוספים)...');
    const examSessionsResults = await db.collection('examSessions').find({
      answers: { $exists: true, $ne: [] }
    }).toArray();
    
    console.log(`נמצאו ${examSessionsResults.length} examSessions עם תשובות...`);
    
    for (const session of examSessionsResults) {
      if (!session.answers) continue;
      
      // בדוק אם יש ציוני 0 ללא feedback בsession הזה
      // (לרוב הציונים נשמרים בfinalExams או examGrades, אבל נבדוק)
      // אין ציונים ישירים בexamSessions, אז נדלג על זה
    }
    
    // מיון לפי examId ואז לפי questionIndex
    allCases.sort((a, b) => {
      if (a.examId !== b.examId) {
        return a.examId.localeCompare(b.examId);
      }
      return a.questionIndex - b.questionIndex;
    });
    
    console.log(`\n📋 רשימה מלאה של ${allCases.length} מקרים מכל מקורות הנתונים:\n`);
    console.log('='.repeat(120));
    
    if (allCases.length === 0) {
      console.log('✅ לא נמצאו מקרים של ציון 0 ללא הערה באף אחד ממקורות הנתונים!');
      console.log('🎯 כל ציוני ה-0 מכילים הערות מתאימות.');
      return;
    }
    
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
      const questionPreview = case_.questionContent.length > 150 
        ? case_.questionContent.substring(0, 150) + '...'
        : case_.questionContent;
      console.log(`         "${questionPreview}"`);
      
      console.log(`      ✍️ תשובת הסטודנט:`);
      const answerPreview = case_.studentAnswer.length > 200 
        ? case_.studentAnswer.substring(0, 200) + '...'
        : case_.studentAnswer;
      console.log(`         "${answerPreview}"`);
      console.log(`      📋 מקור: ${case_.source}`);
      console.log('');
    });
    
    // הצגת הסיכום לבחינה האחרונה
    if (currentExamId !== null) {
      console.log(`   └── סה"כ ${examCaseCount} שאלות עם ציון 0 ללא הערה בבחינה זו\n`);
    }
    
    // סיכום לפי מקור נתונים
    console.log('📊 סיכום לפי מקור נתונים:');
    console.log('='.repeat(60));
    
    const sourceSummary = {};
    allCases.forEach(case_ => {
      if (!sourceSummary[case_.source]) {
        sourceSummary[case_.source] = {
          count: 0,
          exams: new Set(),
          students: new Set()
        };
      }
      sourceSummary[case_.source].count++;
      sourceSummary[case_.source].exams.add(case_.examId);
      sourceSummary[case_.source].students.add(case_.studentId);
    });
    
    Object.keys(sourceSummary).forEach(source => {
      const summary = sourceSummary[source];
      console.log(`📚 ${source}:`);
      console.log(`   📊 ${summary.count} מקרים`);
      console.log(`   🎯 ${summary.exams.size} בחינות שונות`);
      console.log(`   👥 ${summary.students.size} סטודנטים שונים`);
      console.log('');
    });
    
    // סיכום לפי בחינות
    console.log('📈 סיכום לפי בחינות:');
    console.log('='.repeat(80));
    
    const examSummary = {};
    allCases.forEach(case_ => {
      if (!examSummary[case_.examId]) {
        examSummary[case_.examId] = {
          count: 0,
          questions: [],
          sources: new Set(),
          students: new Set(),
          studentDetails: new Map()
        };
      }
      examSummary[case_.examId].count++;
      examSummary[case_.examId].questions.push(case_.questionIndex);
      examSummary[case_.examId].sources.add(case_.source);
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
      
      summary.students.forEach(studentId => {
        const studentInfo = summary.studentDetails.get(studentId);
        console.log(`       - ${studentInfo.name} (${studentId}) - ${studentInfo.email}`);
      });
      
      console.log(`   💾 מקורות: ${[...summary.sources].join(', ')}`);
      console.log('');
    });
    
    // סטטיסטיקות כלליות
    console.log('📊 סטטיסטיקות כלליות:');
    console.log('='.repeat(60));
    console.log(`✅ הניתוח כלל את כל מקורות הנתונים ששימשו את exam-grading:`);
    console.log(`   - finalExams.review (ציונים במבני הנתונים העיקריים)`);
    console.log(`   - examGrades collection (ציונים במבני נתונים נפרדים)`);
    console.log(`   - examSessions collection (נבדק למקרה נתונים נוספים)`);
    console.log(`🔍 נמצאו ${allCases.length} מקרים של ציון 0 ללא הערה בסך הכל`);
    console.log(`🎯 המקרים התפרסו על פני ${Object.keys(examSummary).length} בחינות שונות`);
    
    const uniqueStudents = new Set(allCases.map(c => c.studentId));
    console.log(`👥 מעורבים ${uniqueStudents.size} סטודנטים שונים`);
    
    // סטטיסטיקות לפי מקור
    console.log('\n📋 פילוח לפי מקור נתונים:');
    Object.keys(sourceSummary).forEach(source => {
      const summary = sourceSummary[source];
      console.log(`   ${source}: ${summary.count} מקרים`);
    });
    
    // המלצות
    console.log('\n💡 המלצות לטיפול:');
    console.log('='.repeat(60));
    if (allCases.length > 0) {
      console.log('⚠️  נמצאו מקרים של ציונים 0 ללא הערה');
      console.log('🔧 מומלץ לעבור על המקרים הללו בעמוד "exam-grading" ולהוסיף הערות');
      console.log('📝 כדאי ליצור מדיניות שמחייבת הערה כאשר נותנים ציון 0');
      console.log('🎯 ניתן לטפל במקרים לפי בחינה - התחל מהבחינה עם הכי הרבה מקרים');
      console.log('🔄 כדאי לבדוק סנכרון נתונים בין finalExams ו-examGrades');
      
      // המלצה איך למצוא את המקרים ב-UI
      console.log('\n🎯 איך למצוא את המקרים בממשק:');
      console.log('1. לך לעמוד exam-grading');
      console.log('2. חפש את מזהי הבחינות הבאים:');
      Object.keys(examSummary).forEach(examId => {
        console.log(`   - ${examId}`);
      });
      console.log('3. בכל בחינה, בדוק שאלות עם ציון 0 וודא שיש להן הערות');
    } else {
      console.log('✅ לא נמצאו מקרים בעייתיים - כל ציוני ה-0 כוללים הערות');
    }
    
    console.log('\n🏁 ניתוח מלא הושלם בהצלחה!');
    console.log('📊 נבדקו כל מקורות הנתונים הרלוונטיים לעמוד exam-grading');
    
  } catch (error) {
    console.error('❌ שגיאה בניתוח:', error);
  } finally {
    await client.close();
  }
}

// הרצה
completeZeroScoresAnalysis();