import { NextRequest, NextResponse } from 'next/server';
import { getTemplateService } from '@/lib/template-service';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/templates/[id]/preview - Preview a template with sample values
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { searchParams } = new URL(request.url);
    const sampleCount = parseInt(searchParams.get('sampleCount') || '3');
    
    const service = await getTemplateService();
    const preview = await service.previewTemplate(params.id, sampleCount);
    
    if (!preview) {
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
      data: preview 
    });
  } catch (error) {
    console.error('Error previewing template:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to preview template',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
