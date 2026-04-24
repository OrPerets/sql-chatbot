import { NextRequest, NextResponse } from 'next/server';
import { getQuestionGenerator } from '@/lib/question-generator';
import { buildInlineQuestionPreviews } from '@/app/homework/utils/inline-question-parameters';
import type { Question } from '@/app/homework/types';

interface RouteParams {
  params: Promise<{
    setId: string;
    studentId: string;
  }>;
}

/**
 * POST /api/homework/[setId]/students/[studentId]/preview-questions - Preview questions for a specific student
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { setId, studentId } = await params;
    const body = await request.json();
    
    let previews;

    if (body.inlineQuestions && Array.isArray(body.inlineQuestions) && body.inlineQuestions.length > 0) {
      previews = body.inlineQuestions.flatMap((question: Question) =>
        buildInlineQuestionPreviews(question, {
          homeworkSetId: setId,
          studentId,
          sampleCount: body.sampleCount ?? 3,
        }).map((preview) => ({
          questionId: question.id,
          question: preview.question,
          variables: preview.variables,
        })),
      );
    } else {
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
      previews = await generator.previewQuestionsForStudent(
        setId,
        studentId,
        body.templateIds
      );
    }
    
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
