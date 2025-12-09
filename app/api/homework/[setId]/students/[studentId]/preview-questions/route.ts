import { NextRequest, NextResponse } from 'next/server';
import { getQuestionGenerator } from '@/lib/question-generator';

interface RouteParams {
  params: {
    setId: string;
    studentId: string;
  };
}

/**
 * POST /api/homework/[setId]/students/[studentId]/preview-questions - Preview questions for a specific student
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.json();
    
    if (!body.templateIds || !Array.isArray(body.templateIds) || body.templateIds.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing or invalid templateIds array' 
        },
        { status: 400 }
      );
    }

    const generator = await getQuestionGenerator();
    const previews = await generator.previewQuestionsForStudent(
      params.setId,
      params.studentId,
      body.templateIds
    );
    
    return NextResponse.json({ 
      success: true, 
      data: previews 
    });
  } catch (error) {
    console.error('Error previewing questions for student:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to preview questions for student',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
