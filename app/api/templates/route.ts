import { NextRequest, NextResponse } from 'next/server';
import { getTemplateService } from '@/lib/template-service';
import type { QuestionTemplate } from '@/app/homework/types';

/**
 * GET /api/templates - Get all question templates
 */
export async function GET() {
  try {
    const service = await getTemplateService();
    const templates = await service.getTemplates();
    
    return NextResponse.json({ 
      success: true, 
      data: templates 
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch templates',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates - Create a new question template
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.name || !body.template || !body.variables) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: name, template, variables' 
        },
        { status: 400 }
      );
    }

    const service = await getTemplateService();
    const template = await service.createTemplate(body);
    
    return NextResponse.json({ 
      success: true, 
      data: template 
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create template',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
