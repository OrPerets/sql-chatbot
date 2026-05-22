import { NextRequest, NextResponse } from 'next/server';
import { getRenderedQuestionsForStudent, HomeworkSetNotFoundError } from '@/lib/student-questions';

interface RouteParams {
  params: Promise<{
    setId: string;
    studentId: string;
  }>;
}

/**
 * GET /api/homework/[setId]/questions/student/[studentId] - Get questions for a specific student
 * This endpoint automatically generates parametric questions if they don't exist
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { setId, studentId } = await params;
    
    console.log(`🎓 Getting questions for student ${studentId} in homework set ${setId}`);
    const questions = await getRenderedQuestionsForStudent(setId, studentId);
    console.log(`📋 Returning ${questions.length} questions for student ${studentId}`);

    return NextResponse.json(questions);
    
  } catch (error) {
    if (error instanceof HomeworkSetNotFoundError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Homework set not found',
        },
        { status: 404 },
      );
    }

    console.error('Error getting questions for student:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to get questions for student',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
