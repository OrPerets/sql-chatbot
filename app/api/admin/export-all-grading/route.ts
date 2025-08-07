import { NextRequest, NextResponse } from 'next/server';
import config from '../../../config';
import * as XLSX from 'xlsx';
import { MongoClient } from 'mongodb';

const SERVER_BASE = config.serverUrl;

// MongoDB connection URL - using the same credentials as mentor server
const DB_USERNAME = process.env.dbUserName || "sql-admin";
const DB_PASSWORD = process.env.dbPassword || "SMff5PqhhoVbX6z7";
const MONGO_URL = process.env.MONGODB_URI || `mongodb+srv://${DB_USERNAME}:${DB_PASSWORD}@sqlmentor.ydqmecv.mongodb.net/?retryWrites=true&w=majority&appName=SQLMentor`;

interface StudentAnswer {
  examId: string;
  studentEmail: string;
  studentName?: string;
  studentId?: string;
  questionIndex: number;
  studentAnswer: string;
  timeSpent: number;
  timestamp: string;
  isCorrect: boolean;
  grade?: number;
  feedback?: string;
  examStartTime: string;
  _id?: string;
}

interface Question {
  id: number;
  question: string;
  difficulty: string;
  points: number;
  solution_example?: string;
  answerCount?: number;
  gradedCount?: number;
  ungradedCount?: number;
}

interface QuestionWithAnswers extends Question {
  answers?: StudentAnswer[];
  totalAnswers?: number;
  gradedAnswers?: number;
  averageGrade?: number;
}

// Configuration for performance
const EXPORT_TIMEOUT = 50000; // 50 seconds (Vercel has 60s limit)
const BATCH_SIZE = 5; // Reduce batch size for better reliability
const ANSWERS_LIMIT = 300; // Reduce limit for faster processing
const QUESTION_TIMEOUT = 15000; // 15 seconds per question (increased from 8s)
const QUESTIONS_TIMEOUT = 15000; // 15 seconds for questions fetch

export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Starting DIRECT DATABASE export...');
    
    // Connect directly to MongoDB with increased timeout and better error handling
    const client = new MongoClient(MONGO_URL, {
      connectTimeoutMS: 60000, // 60 seconds
      serverSelectionTimeoutMS: 60000, // 60 seconds
      socketTimeoutMS: 60000, // 60 seconds for socket operations
      maxPoolSize: 1,
      retryWrites: true,
      heartbeatFrequencyMS: 30000, // 30 seconds between heartbeats
    });
    
    console.log('🔌 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB successfully');
    
    try {
      // Get all student data directly from database
      const result = await performDirectDatabaseExport(client);
      await client.close();
      console.log('✅ Database connection closed');
      return result;
      
    } catch (error) {
      console.error('❌ Error in performDirectDatabaseExport:', error);
      await client.close();
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error in direct database export:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      code: error.code
    });
    
    // Fallback to API-based export only if database fails
    console.log('🔄 Database connection failed, falling back to mentor-server API export...');
    return await performMentorServerExport();
  }
}

async function performDirectDatabaseExport(client: any) {
  console.log('📊 Fetching data directly from "experiment" database...');
  
  try {
    // Connect to the experiment database specifically  
    const experimentDb = client.db("experiment");
    console.log('✅ Connected to experiment database');
    
    // First, test basic collection access
    console.log('🔍 Testing basic collection access...');
    const testCount = await experimentDb.collection("finalExams").countDocuments();
    console.log(`✅ Collection accessible: ${testCount} total documents`);
    
    // Get completed final exams with graded answers (limit for testing)
    console.log('🔍 Querying finalExams collection...');
    
    // Try the simplest possible query first
    console.log('⏱️ Trying minimal query first...');
    const minimalQueryPromise = experimentDb.collection("finalExams")
      .find({})
      .limit(10)
      .maxTimeMS(15000)
      .toArray();
    
    const quickTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Minimal query timeout after 20 seconds')), 20000);
    });
    
    let finalExams;
    try {
      finalExams = await Promise.race([minimalQueryPromise, quickTimeoutPromise]);
      console.log(`✅ Minimal query succeeded - found ${finalExams.length} exams`);
    } catch (error) {
      console.log('❌ Even minimal query failed, falling back to API export');
      throw new Error('Database query performance issue - using API fallback');
    }
    
    console.log(`✅ Found ${finalExams.length} completed exams`);
    
    // Filter for exams that actually have grades (do this after query to avoid complex MongoDB query)
    console.log('🔍 Filtering for graded exams...');
    const gradedExams = finalExams.filter((exam: any) => 
      exam.review && 
      exam.review.questionGrades && 
      Array.isArray(exam.review.questionGrades) && 
      exam.review.questionGrades.length > 0
    );
    
    console.log(`✅ Found ${gradedExams.length} exams with grades`);
    
    if (gradedExams.length === 0) {
      console.log('⚠️ No graded exams found');
      return await createEmptyExport();
    }
    
    // Also get questions collection for additional question details
    console.log('🔍 Querying questions collection...');
    const questionsPromise = experimentDb.collection("questions")
      .find({})
      .maxTimeMS(5000) // 5 second timeout
      .toArray();
      
    const questionsTimeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Questions query timeout')), 8000);
    });
    
    const questions = await Promise.race([questionsPromise, questionsTimeoutPromise]);
    console.log(`✅ Found ${questions.length} questions`);
    
    // Process and organize data by student
    console.log('⚙️ Processing exam data...');
    const allStudentData = new Map<string, any>();
    
    gradedExams.forEach((exam: any) => {
      const studentKey = exam.studentEmail || 'unknown';
      
      if (!studentKey || studentKey === 'unknown') return;
      
      if (!allStudentData.has(studentKey)) {
        allStudentData.set(studentKey, {
          studentEmail: exam.studentEmail || 'לא זמין',
          studentName: exam.studentName || 'לא צוין',
          studentId: exam.studentId || 'לא צוין',
          examId: exam._id.toString(),
          examStartTime: exam.startTime || '',
          questions: []
        });
      }
      
      const studentData = allStudentData.get(studentKey);
      
      // Process each answer in mergedAnswers
      if (exam.mergedAnswers && Array.isArray(exam.mergedAnswers)) {
        exam.mergedAnswers.forEach((answer: any) => {
          // Find the corresponding grade from review.questionGrades
          let grade = 'לא צוין';
          let feedback = 'אין משוב';
          let maxScore = 0;
          
          if (exam.review && exam.review.questionGrades) {
            const questionGrade = exam.review.questionGrades.find((qg: any) => qg.questionIndex === answer.questionIndex);
            if (questionGrade) {
              grade = questionGrade.score ?? 'לא צוין';
              feedback = questionGrade.feedback || 'אין משוב';
              maxScore = questionGrade.maxScore || 0;
            }
          }
          
          // Find question details
          const questionId = parseInt(answer.questionId) || parseInt(answer.questionDetails?.id) || answer.questionDetails?.id;
          const questionDetails = questions.find(q => q.id === questionId);
          
          studentData.questions.push({
            questionId: questionId,
            questionText: answer.questionText || questionDetails?.question || 'שאלה לא זמינה',
            questionDifficulty: answer.difficulty || questionDetails?.difficulty || 'לא צוין',
            questionPoints: maxScore || questionDetails?.points || 0,
            questionIndex: answer.questionIndex ?? 0,
            studentAnswer: answer.studentAnswer || answer.answer || 'לא זמין',
            timeSpent: answer.timeSpent || 0,
            isCorrect: answer.isCorrect || false,
            grade: grade,
            feedback: feedback,
            timestamp: answer.timestamp || answer.submittedAt || exam.startTime || '',
            solutionExample: questionDetails?.solution_example || 'אין דוגמה',
            gradedBy: exam.review?.gradedBy || 'admin',
            maxScore: maxScore
          });
        });
      }
    });
    
    console.log(`✅ Organized data for ${allStudentData.size} students`);
    console.log(`📊 Total question responses: ${Array.from(allStudentData.values()).reduce((sum, student) => sum + student.questions.length, 0)}`);
    
    console.log('📊 Creating Excel export...');
    return await createExcelExport(allStudentData);
    
  } catch (error) {
    console.error('❌ Error in performDirectDatabaseExport:', error);
    throw error;
  }
}

async function performMentorServerExport() {
  console.log('🚀 Using mentor-server API for export...');
  
  try {
    // Get data directly from mentor-server API which is already connected to DB
    const mentorServerUrl = process.env.MENTOR_SERVER_URL || 'https://database-mentor.vercel.app';
    
    console.log('📋 Fetching final exams from mentor-server...');
    const response = await fetch(`${mentorServerUrl}/admin/final-exams?limit=100`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`Mentor-server API failed: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Got ${data.examSessions?.length || 0} exams from mentor-server`);
    
    // Process the data into Excel format
    const examSessions = data.examSessions || [];
    const gradedExams = examSessions.filter((exam: any) => exam.graded);
    
    console.log(`📊 Found ${gradedExams.length} graded exams`);
    
    if (gradedExams.length === 0) {
      return await createEmptyExport();
    }
    
    // Create simple Excel export from the data
    const studentData = new Map<string, any>();
    
    // For now, create a simple summary export
    gradedExams.forEach((exam: any) => {
      const studentKey = exam.studentEmail || 'unknown';
      
      if (!studentData.has(studentKey)) {
        studentData.set(studentKey, {
          studentEmail: studentKey,
          studentName: exam.studentName || 'לא זמין',
          studentId: exam.studentId || 'לא זמין',
          examDate: exam.startTime ? new Date(exam.startTime).toLocaleDateString('he-IL') : 'לא זמין',
          totalScore: exam.score || 0,
          maxScore: exam.totalQuestions ? exam.totalQuestions * 10 : 100, // Estimate
          status: exam.status || 'לא זמין',
          examId: exam._id
        });
      }
    });
    
    // Create Excel workbook
    const wb = XLSX.utils.book_new();
    
    // Student Overview Sheet
    const studentOverviewData = Array.from(studentData.values()).map(student => ({
      'כתובת מייל': student.studentEmail,
      'שם התלמיד': student.studentName,
      'מספר תלמיד': student.studentId,
      'תאריך הבחינה': student.examDate,
      'ציון': student.totalScore,
      'ציון מקסימלי': student.maxScore,
      'אחוזים': student.maxScore > 0 ? Math.round((student.totalScore / student.maxScore) * 100) + '%' : '0%',
      'סטטוס': student.status,
      'מזהה בחינה': student.examId
    }));
    
    const ws1 = XLSX.utils.json_to_sheet(studentOverviewData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Student Overview');
    
    // Generate and return Excel file
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    const headers = new Headers({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="grading_export_simple_${new Date().toISOString().split('T')[0]}.xlsx"`,
      'Content-Length': excelBuffer.length.toString(),
    });
    
    console.log(`✅ Generated simple Excel export: ${studentOverviewData.length} students`);
    
    return new NextResponse(excelBuffer, { 
      status: 200, 
      headers 
    });
    
  } catch (error) {
    console.error('❌ Mentor-server export failed:', error);
    
    // Final fallback - create empty export
    console.log('🔄 Creating empty export as final fallback...');
    return await createEmptyExport();
  }
}

async function performAPIExport() {
  const startTime = Date.now();
  console.log('📋 Fetching questions in optimized mode...');
  
  // Step 1: Fetch questions with smaller initial batch
  const questionsResponse = await fetch(`${SERVER_BASE}/api/admin/questions-optimized?page=1&limit=50&includeGradingStatus=true`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    signal: AbortSignal.timeout(QUESTIONS_TIMEOUT),
    });

    if (!questionsResponse.ok) {
      throw new Error('Failed to fetch questions');
    }

    const questionsData = await questionsResponse.json();
    const questions: QuestionWithAnswers[] = questionsData.questions || [];
    
    console.log(`✅ Found ${questions.length} questions`);
    
  if (questions.length === 0) {
    return await createEmptyExport();
  }

  // Step 2: Process questions in batches to avoid timeout
  console.log('👨‍🎓 Fetching student answers in optimized batches...');
  
  const allStudentData = new Map<string, any>();
  
  // Process questions in smaller batches
  for (let batchStart = 0; batchStart < questions.length; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE, questions.length);
    const batch = questions.slice(batchStart, batchEnd);
    
    console.log(`🔄 Processing batch ${Math.floor(batchStart/BATCH_SIZE) + 1}/${Math.ceil(questions.length/BATCH_SIZE)} (questions ${batchStart + 1}-${batchEnd})`);
    
    // Process batch in parallel instead of sequential
    const batchPromises = batch.map(async (questionData, index) => {
      const questionId = questionData?.id;
      
      if (!questionId) {
        console.log(`⚠️ Skipping question - missing ID`);
        return null;
      }
      
      try {
        const answersResponse = await fetch(`${SERVER_BASE}/api/admin/question/${questionId}/answers-optimized?page=1&limit=${ANSWERS_LIMIT}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
          signal: AbortSignal.timeout(QUESTION_TIMEOUT),
        });

        if (answersResponse.ok) {
          const answersData = await answersResponse.json();
          const answers: StudentAnswer[] = answersData.answers || [];
          
          console.log(`   📊 Found ${answers.length} answers for question ${questionId}`);
          
          return {
            questionId,
            questionData,
            answers,
            questionFromAPI: answersData.question
          };
        } else {
          console.log(`   ⚠️ Failed to fetch answers for question ${questionId}`);
          return null;
        }
      } catch (questionError) {
        console.log(`   ❌ Error fetching answers for question ${questionId}:`, questionError);
        return null;
      }
    });
    
    // Wait for all requests in this batch to complete
    const batchResults = await Promise.allSettled(batchPromises);
    
    // Count successful vs failed requests
    let successCount = 0;
    let failCount = 0;
    
    // Process successful results
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        successCount++;
        const { questionId, questionData, answers, questionFromAPI } = result.value;
        
        // Organize answers by student
          answers.forEach(answer => {
            const studentKey = answer?.studentEmail;
            
            if (!studentKey) {
              return;
            }
            
            if (!allStudentData.has(studentKey)) {
              allStudentData.set(studentKey, {
                studentEmail: answer.studentEmail || 'לא זמין',
                studentName: answer.studentName || 'לא צוין',
                studentId: answer.studentId || 'לא צוין',
                examId: answer.examId || 'לא זמין',
                examStartTime: answer.examStartTime || '',
                questions: []
              });
            }
            
            const studentData = allStudentData.get(studentKey);
            studentData.questions.push({
              questionId: questionId,
            questionText: questionFromAPI?.question || questionData?.question || 'שאלה לא זמינה',
            questionDifficulty: questionFromAPI?.difficulty || questionData?.difficulty || 'לא צוין',
            questionPoints: questionFromAPI?.points || questionData?.points || 0,
              questionIndex: answer.questionIndex ?? 0,
              studentAnswer: answer.studentAnswer || 'לא זמין',
              timeSpent: answer.timeSpent || 0,
              isCorrect: answer.isCorrect || false,
              grade: answer.grade ?? 'לא צוין',
              feedback: answer.feedback || 'אין משוב',
              timestamp: answer.timestamp || '',
            solutionExample: questionFromAPI?.solution_example || questionData?.solution_example || 'אין דוגמה'
          });
          });
        } else {
        failCount++;
        if (result.status === 'rejected') {
          console.log(`   ⚠️ Batch request failed:`, result.reason?.message || 'Unknown error');
        }
      }
    });
    
    console.log(`   📊 Batch completed: ${successCount} success, ${failCount} failed`);
    
    // If too many failures, stop processing to avoid infinite loops
    if (failCount > successCount && failCount >= 3) {
      console.log('⚠️ Too many failures in batch, stopping to prevent server overload');
      break;
    }
    
    // Add small delay between batches to reduce server load
    if (batchStart + BATCH_SIZE < questions.length) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }
    
    // Check if we're approaching timeout
    const elapsed = Date.now() - startTime;
    if (elapsed > EXPORT_TIMEOUT * 0.75) { // 75% of timeout (more conservative)
      console.log('⏰ Approaching timeout, stopping batch processing');
      break;
    }
  }

  console.log(`✅ Organized data for ${allStudentData.size} students`);

  // Return the Excel export
  return await createExcelExport(allStudentData);
}

async function createExcelExport(allStudentData: Map<string, any>) {
  try {
    console.log('📊 Creating Excel workbook...');
    console.log(`📊 Processing data for ${allStudentData.size} students`);
    
    const workbook = XLSX.utils.book_new();
    
    // Create grading data
    console.log('⚙️ Creating grading data array...');
    const gradingData: any[] = [];
    
    let totalQuestions = 0;
    Array.from(allStudentData.values()).forEach(student => {
      student.questions.forEach((q: any) => {
        totalQuestions++;
        gradingData.push({
          'שם סטודנט': student.studentName || 'לא צוין',
          'אימייל': student.studentEmail || 'לא זמין',
          'מזהה': student.studentId || 'לא צוין',
          'מזהה שאלה': q.questionId || '',
          'שאלה': String(q.questionText || 'שאלה לא זמינה').substring(0, 200),
          'תשובת סטודנט': String(q.studentAnswer || 'לא זמין'),
          'ציון': q.grade ?? '',
          'ציון מקסימלי': q.maxScore ?? '',
          'הערות': String(q.feedback || ''),
          'מדרג': q.gradedBy || 'לא ידוע',
          'זמן הגשה': q.timestamp || ''
        });
      });
    });
    
    console.log(`✅ Created ${gradingData.length} grading entries (${totalQuestions} total questions)`);
    
    // Sort by student name
    console.log('🔄 Sorting data by student name...');
    gradingData.sort((a, b) => (a['שם סטודנט'] || '').localeCompare(b['שם סטודנט'] || ''));
    
    console.log('📄 Creating Excel sheet...');
    const gradingSheet = XLSX.utils.json_to_sheet(gradingData);
    
  // Set column widths
    gradingSheet['!cols'] = [
      { wch: 20 }, // שם סטודנט
      { wch: 25 }, // אימייל
      { wch: 15 }, // מזהה
    { wch: 12 }, // מזהה שאלה
    { wch: 50 }, // שאלה
    { wch: 50 }, // תשובת סטודנט
    { wch: 8 },  // ציון
    { wch: 8 },  // ציון מקסימלי
    { wch: 30 }, // הערות
    { wch: 10 }, // מדרג
    { wch: 20 }  // זמן הגשה
  ];
  
  XLSX.utils.book_append_sheet(workbook, gradingSheet, 'ציונים מנהל');

  // Create student summary
    const studentSummary: any[] = [];
    
    Array.from(allStudentData.values()).forEach(student => {
      let totalPoints = 0;
      let gradedQuestions = 0;
      let totalQuestions = student.questions.length;
      
      student.questions.forEach((q: any) => {
        if (typeof q.grade === 'number') {
          totalPoints += q.grade;
          gradedQuestions++;
        }
      });
      
      studentSummary.push({
        'שם סטודנט': student.studentName || 'לא צוין',
        'מזהה': student.studentId || 'לא צוין', 
        'ציון כולל': totalPoints,
        'שאלות מצוינות': `${gradedQuestions}/${totalQuestions}`,
        'סטטוס': gradedQuestions === totalQuestions ? 'הושלם' : `נותרו ${totalQuestions - gradedQuestions}`
      });
    });
    
    studentSummary.sort((a, b) => (a['שם סטודנט'] || '').localeCompare(b['שם סטודנט'] || ''));
    
    const summarySheet = XLSX.utils.json_to_sheet(studentSummary);
    
    summarySheet['!cols'] = [
    { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 20 }
    ];
    
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'סיכום ציונים');

    // Generate Excel buffer
    console.log('📦 Generating Excel buffer...');
    const excelBuffer = XLSX.write(workbook, { 
      type: 'buffer', 
      bookType: 'xlsx',
      compression: true 
    });

    console.log('✅ Excel file generated successfully');
    console.log(`📊 Export summary: ${allStudentData.size} students, ${gradingData.length} total responses`);
    console.log(`📦 Buffer size: ${excelBuffer.length} bytes`);

    const fileName = `all-student-grading-${new Date().toISOString().split('T')[0]}.xlsx`;
    
    console.log(`📤 Returning Excel file: ${fileName}`);
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-cache',
      },
    });
    
  } catch (error) {
    console.error('❌ Error in createExcelExport:', error);
    throw error;
  }
}

async function createEmptyExport() {
  console.log('⚠️ No data found - creating empty workbook');
  
  const workbook = XLSX.utils.book_new();
  const emptySheet = XLSX.utils.json_to_sheet([{
    'הודעה': 'לא נמצאו נתוני ציונים לייצוא',
    'סיבה אפשרית': 'אין סטודנטים שענו על שאלות, או שיש בעיה בחיבור לשרת',
    'המלצה': 'בדוק שיש נתוני ציונים בממשק grade-by-question ונסה שוב'
  }]);
  XLSX.utils.book_append_sheet(workbook, emptySheet, 'הודעה');
  
  const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return new NextResponse(excelBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="no-data-found.xlsx"',
      'Cache-Control': 'no-cache',
    },
  });
}

async function createSimplifiedExport() {
  console.log('🔄 Creating simplified export after timeout...');
  
  try {
    // Try to get just a few questions quickly
    const quickResponse = await fetch(`${SERVER_BASE}/api/admin/questions-optimized?page=1&limit=3`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000), // Increased timeout for simplified export
    });

    if (!quickResponse.ok) {
      return await createEmptyExport();
    }

    const data = await quickResponse.json();
    const questions = data.questions || [];

    const workbook = XLSX.utils.book_new();
    const simplifiedData = questions.map((q: any, index: number) => ({
      'מספר שאלה': q.id || index + 1,
      'שאלה': String(q.question || 'לא זמין').substring(0, 100),
      'רמת קושי': q.difficulty || 'לא צוין',
      'נקודות': q.points || 0,
      'הודעה': 'ייצוא מהיר - לנתונים מלאים נסה שוב מאוחר יותר'
    }));

    const sheet = XLSX.utils.json_to_sheet(simplifiedData);
    sheet['!cols'] = [{ wch: 15 }, { wch: 50 }, { wch: 15 }, { wch: 10 }, { wch: 40 }];
    
    XLSX.utils.book_append_sheet(workbook, sheet, 'ייצוא מהיר');

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    return new NextResponse(excelBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="quick-export.xlsx"',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error creating simplified export:', error);
    return await createEmptyExport();
  }
}