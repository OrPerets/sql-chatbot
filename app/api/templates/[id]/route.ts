import { NextRequest, NextResponse } from 'next/server';
import { getTemplateService } from '@/lib/template-service';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/templates/[id] - Get a specific template by ID
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const service = await getTemplateService();
    const template = await service.getTemplateById(id);
    
    if (!template) {
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
      data: template 
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch template',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/templates/[id] - Update a template
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const service = await getTemplateService();
    const template = await service.updateTemplate(id, body);
    
    if (!template) {
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
      data: template 
    });
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update template',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/templates/[id] - Delete a template
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const service = await getTemplateService();
    const deleted = await service.deleteTemplate(id);
    
    if (!deleted) {
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
      message: 'Template deleted successfully' 
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete template',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
