import { NextRequest, NextResponse } from 'next/server';
import { getTemplateService } from '@/lib/template-service';

/**
 * POST /api/questions/instantiate - Instantiate a question from a template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.templateId || !body.studentId || !body.homeworkSetId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: templateId, studentId, homeworkSetId' 
        },
        { status: 400 }
      );
    }

    const service = await getTemplateService();
    const instantiatedQuestion = await service.instantiateQuestion(
      body.templateId,
      body.studentId,
      body.homeworkSetId,
      body.seed
    );
    
    if (!instantiatedQuestion) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Template not found' 
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      data: instantiatedQuestion 
    }, { status: 201 });
  } catch (error) {
    console.error('Error instantiating question:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to instantiate question',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
