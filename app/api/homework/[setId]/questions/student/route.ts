import { NextResponse } from 'next/server';
import { getRenderedQuestionsForStudents, HomeworkSetNotFoundError } from '@/lib/student-questions';

interface RouteParams {
  params: Promise<{ setId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { setId } = await params;
    const body = await request.json().catch(() => ({}));
    const studentIds = Array.isArray(body.studentIds)
      ? body.studentIds.filter((studentId: unknown): studentId is string => typeof studentId === 'string' && studentId.trim().length > 0)
      : [];

    if (studentIds.length === 0) {
      return NextResponse.json({ error: 'studentIds must contain at least one student ID' }, { status: 400 });
    }

    const questionsByStudent = await getRenderedQuestionsForStudents(setId, studentIds);
    return NextResponse.json(questionsByStudent);
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

    console.error('Error getting questions for students:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get questions for students',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
