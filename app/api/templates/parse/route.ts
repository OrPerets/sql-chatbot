import { NextRequest, NextResponse } from 'next/server';
import { getTemplateService } from '@/lib/template-service';

/**
 * POST /api/templates/parse - Parse a template and extract variables
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.template) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required field: template' 
        },
        { status: 400 }
      );
    }

    const service = await getTemplateService();
    const parseResult = await service.parseTemplate(body.template);
    
    return NextResponse.json({ 
      success: true, 
      data: parseResult 
    });
  } catch (error) {
    console.error('Error parsing template:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to parse template',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
