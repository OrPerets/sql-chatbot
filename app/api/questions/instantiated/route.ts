import { NextRequest, NextResponse } from 'next/server';
import { getTemplateService } from '@/lib/template-service';

/**
 * GET /api/questions/instantiated - Get instantiated questions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const homeworkSetId = searchParams.get('homeworkSetId');
    
    if (!studentId && !homeworkSetId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Must provide either studentId or homeworkSetId' 
        },
        { status: 400 }
      );
    }

    const service = await getTemplateService();
    let questions;
    
    if (studentId) {
      questions = await service.getInstantiatedQuestionsByStudent(studentId, homeworkSetId || undefined);
    } else {
      questions = await service.getInstantiatedQuestionsByHomeworkSet(homeworkSetId!);
    }
    
    return NextResponse.json({ 
      success: true, 
      data: questions 
    });
  } catch (error) {
    console.error('Error fetching instantiated questions:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch instantiated questions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
