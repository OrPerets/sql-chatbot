import { NextRequest, NextResponse } from 'next/server';
import { getQuestionGenerator } from '@/lib/question-generator';

interface RouteParams {
  params: {
    setId: string;
    studentId: string;
  };
}

/**
 * POST /api/homework/[setId]/students/[studentId]/generate-questions - Generate questions for a specific student
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
    const result = await generator.generateQuestionsForStudent(
      params.setId,
      params.studentId,
      body.templateIds
    );
    
    return NextResponse.json({ 
      success: result.success, 
      data: {
        generated: result.generated,
        errors: result.errors
      }
    });
  } catch (error) {
    console.error('Error generating questions for student:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate questions for student',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
