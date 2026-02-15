import { NextRequest, NextResponse } from 'next/server';
import { getQuestionGenerator } from '@/lib/question-generator';

interface RouteParams {
  params: Promise<{
    setId: string;
  }>;
}

/**
 * POST /api/homework/[setId]/generate-questions - Generate questions from templates for students
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { setId } = await params;
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

    if (!body.studentIds || !Array.isArray(body.studentIds) || body.studentIds.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing or invalid studentIds array' 
        },
        { status: 400 }
      );
    }

    const generator = await getQuestionGenerator();
    const result = await generator.generateQuestionsForHomeworkSet(
      setId,
      body.templateIds,
      body.studentIds
    );
    
    return NextResponse.json({ 
      success: result.success, 
      data: {
        generated: result.generated,
        errors: result.errors
      }
    });
  } catch (error) {
    console.error('Error generating questions:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate questions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
