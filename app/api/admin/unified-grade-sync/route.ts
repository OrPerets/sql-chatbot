import { NextRequest, NextResponse } from 'next/server';
import config from '../../../config';

const SERVER_BASE = config.serverUrl;

/**
 * Unified Grade Sync API
 * Ensures all grading data is consistent across grade-by-questions, exam-grading, and exports
 */

export async function POST(request: NextRequest) {
  try {
    const { action, examId, questionIndex, grade, feedback } = await request.json();
    
    switch (action) {
      case 'sync_grade':
        return await syncSingleGrade(examId, questionIndex, grade, feedback);
      case 'sync_exam':
        return await syncExamGrades(examId);
      case 'validate_grades':
        return await validateExamGrades(examId);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in unified grade sync:', error);
    return NextResponse.json(
      { error: 'Failed to sync grades', details: error.message },
      { status: 500 }
    );
  }
}

async function syncSingleGrade(examId: string, questionIndex: number, grade: number, feedback: string) {
  // First save to finalExams.review (primary source)
  const gradeResponse = await fetch(`${SERVER_BASE}/api/admin/grade-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ examId, questionIndex, grade, feedback }),
  });
  
  if (!gradeResponse.ok) {
    throw new Error('Failed to save grade to finalExams');
  }
  
  const gradeResult = await gradeResponse.json();
  
  // Sync to examGrades collection for backward compatibility
  await syncExamGrades(examId);
  
  return NextResponse.json({ 
    success: true, 
    message: 'Grade synced successfully',
    gradeData: gradeResult
  });
}

async function syncExamGrades(examId: string) {
  // Get current grades from finalExams.review
  const examResponse = await fetch(`${SERVER_BASE}/admin/final-exam/${examId}/for-grading`);
  if (!examResponse.ok) {
    throw new Error('Failed to fetch exam data');
  }
  
  const examData = await examResponse.json();
  
  if (examData.review && examData.review.questionGrades) {
    // Sync to examGrades collection
    const syncResponse = await fetch(`${SERVER_BASE}/admin/final-exam/${examId}/grade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionGrades: examData.review.questionGrades,
        totalScore: examData.review.totalScore,
        maxScore: examData.review.maxScore,
        percentage: examData.review.percentage,
        overallFeedback: examData.review.feedback || '',
        grade: examData.review.percentage ? `${examData.review.percentage}%` : '',
        gradedBy: 'admin',
        gradedAt: new Date(),
        isGraded: examData.review.isGraded
      }),
    });
    
    if (!syncResponse.ok) {
      console.warn('Failed to sync to examGrades collection, but finalExams.review is updated');
    }
  }
  
  return NextResponse.json({ 
    success: true, 
    message: 'Exam grades synced successfully',
    totalScore: examData.review?.totalScore || 0,
    questionCount: examData.review?.questionGrades?.length || 0
  });
}

async function validateExamGrades(examId: string) {
  // Check both sources and report differences
  const finalExamResponse = await fetch(`${SERVER_BASE}/admin/final-exam/${examId}/for-grading`);
  const gradeResponse = await fetch(`${SERVER_BASE}/admin/final-exam/${examId}/grade`);
  
  const results = {
    examId,
    finalExamData: null,
    gradeData: null,
    isConsistent: false,
    differences: []
  };
  
  if (finalExamResponse.ok) {
    results.finalExamData = await finalExamResponse.json();
  }
  
  if (gradeResponse.ok) {
    results.gradeData = await gradeResponse.json();
  }
  
  // Compare the two sources
  if (results.finalExamData?.review && results.gradeData) {
    const finalExamScore = results.finalExamData.review.totalScore || 0;
    const gradeScore = results.gradeData.totalScore || 0;
    
    results.isConsistent = finalExamScore === gradeScore;
    
    if (!results.isConsistent) {
      results.differences.push({
        field: 'totalScore',
        finalExam: finalExamScore,
        examGrades: gradeScore
      });
    }
  }
  
  return NextResponse.json(results);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const examId = searchParams.get('examId');
    const action = searchParams.get('action') || 'validate_grades';
    
    if (!examId) {
      return NextResponse.json({ error: 'examId is required' }, { status: 400 });
    }
    
    if (action === 'validate_grades') {
      return await validateExamGrades(examId);
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in unified grade validation:', error);
    return NextResponse.json(
      { error: 'Failed to validate grades', details: error.message },
      { status: 500 }
    );
  }
}