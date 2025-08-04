import { NextRequest, NextResponse } from 'next/server';
import config from '../../../../../config';

const SERVER_BASE = config.serverUrl;

export async function GET(
  request: NextRequest,
  { params }: { params: { examId: string } }
) {
  try {
    const { examId } = params;
    
    // Fetch exam data
    let examResponse = await fetch(`${SERVER_BASE}/admin/final-exam/${examId}/for-grading`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });
    
    let isFinalExam = true;
    
    if (!examResponse.ok) {
      // Fall back to regular exam
      examResponse = await fetch(`${SERVER_BASE}/admin/exam/${examId}/for-grading`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });
      isFinalExam = false;
      
      if (!examResponse.ok) {
        throw new Error(`Failed to fetch exam data: ${examResponse.status}`);
      }
    }
    
    const examData = await examResponse.json();
    
    // Fetch grading data - prioritize finalExams.review over examGrades
    let gradeData = null;
    
    // For final exams, check if grades are stored in the exam's review field
    if (isFinalExam && examData.review && examData.review.questionGrades) {
      gradeData = {
        questionGrades: examData.review.questionGrades,
        totalScore: examData.review.totalScore || 0,
        grade: examData.review.percentage ? `${examData.review.percentage}%` : '',
        overallFeedback: examData.review.feedback || ''
      };
    } else {
      // Fallback to examGrades collection
      const gradeResponse = await fetch(`${SERVER_BASE}/admin/${isFinalExam ? 'final-exam' : 'exam'}/${examId}/grade`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (gradeResponse.ok) {
        gradeData = await gradeResponse.json();
      }
    }
    
    // Filter unique answers to avoid duplicates
    const uniqueAnswers = examData.answers ? examData.answers.filter((answer, index, arr) => {
      const firstOccurrence = arr.findIndex(a => a.questionText.trim() === answer.questionText.trim());
      return index === firstOccurrence;
    }) : [];
    
    // Calculate total possible points
    const totalPossiblePoints = uniqueAnswers.reduce((sum, answer) => 
      sum + (answer.questionDetails?.points || 1), 0
    );
    
    // Prepare report data with correct field extraction
    const studentInfo = {
      name: examData.session?.studentName || examData.studentName || 'לא צוין',
      studentId: examData.session?.studentId || examData.studentId || 'לא צוין', 
      email: examData.session?.studentEmail || examData.session?.email || examData.studentEmail || examData.email || 'לא צוין',
      examDate: examData.session?.startTime || examData.startTime || examData.createdAt || new Date().toISOString(),
      examType: isFinalExam ? 'מועד סופי' : 'מבחן רגיל'
    };

    const reportData = {
      studentInfo,
      questions: uniqueAnswers.map((answer, index) => {
        const questionPoints = answer.questionDetails?.points || 1;
        let score = 0;
        let feedback = '';
        let isGraded = false;
        
        // Get grading data if available
        if (gradeData?.questionGrades) {
          // Find the matching question grade by questionIndex instead of array index
          const questionGrade = gradeData.questionGrades.find(qg => 
            qg.questionIndex === answer.questionIndex || qg.questionIndex === index
          );
          
          if (questionGrade) {
            score = questionGrade.score || 0;
            feedback = questionGrade.feedback || '';
            isGraded = true;
          } else if (answer.isCorrect) {
            // Fallback to auto-grading if no manual grade exists
            score = questionPoints;
          }
        } else if (answer.isCorrect) {
          // Fallback to auto-grading if no manual grade exists
          score = questionPoints;
        }
        
        return {
          questionNumber: index + 1,
          questionText: answer.questionText || answer.question || 'שאלה לא זמינה',
          studentAnswer: answer.answer || answer.studentAnswer || answer.response || '',
          maxPoints: questionPoints,
          pointsAwarded: score,
          feedback: feedback || (score === questionPoints && !isGraded ? '✅ תשובה נכונה' : ''),
          isGraded: isGraded
        };
      }),
      summary: {
        totalPointsAwarded: gradeData?.totalScore || 0,
        totalPossiblePoints: totalPossiblePoints,
        finalGrade: gradeData?.grade || '',
        overallFeedback: gradeData?.overallFeedback || '',
        questionsCount: uniqueAnswers.length,
        gradedQuestionsCount: gradeData?.questionGrades ? gradeData.questionGrades.length : 0
      },
      metadata: {
        reportGeneratedAt: new Date().toISOString(),
        examId: examId,
        isFinalExam: isFinalExam
      }
    };
    
    return NextResponse.json(reportData);
  } catch (error) {
    console.error('Error generating final exam report:', error);
    return NextResponse.json(
      { error: 'Failed to generate final exam report' },
      { status: 500 }
    );
  }
} 