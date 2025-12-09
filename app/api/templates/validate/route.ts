import { NextRequest, NextResponse } from 'next/server';
import { getTemplateService } from '@/lib/template-service';

/**
 * POST /api/templates/validate - Validate a template and variables
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    if (!body.template || !body.variables) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: template, variables' 
        },
        { status: 400 }
      );
    }

    const service = await getTemplateService();
    const validation = await service.validateTemplate(body.template, body.variables);
    
    return NextResponse.json({ 
      success: true, 
      data: validation 
    });
  } catch (error) {
    console.error('Error validating template:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to validate template',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
