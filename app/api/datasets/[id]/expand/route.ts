import { NextResponse } from "next/server";
import { startDataGeneration } from "@/lib/data-generation";
import type { DataGenerationConfig } from "@/lib/data-generation";

interface RouteParams {
  params: { id: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const body = await request.json();
    
    // Validate request body
    const config: DataGenerationConfig = {
      targetRows: body.targetRows || 5000,
      preserveExisting: body.preserveExisting || true,
      dataTypes: {
        names: body.dataTypes?.names ?? true,
        emails: body.dataTypes?.emails ?? true,
        dates: body.dataTypes?.dates ?? true,
        numbers: body.dataTypes?.numbers ?? true,
        text: body.dataTypes?.text ?? true,
      },
      patterns: {
        realistic: body.patterns?.realistic ?? true,
        relationships: body.patterns?.relationships ?? true,
        constraints: body.patterns?.constraints ?? true,
      },
    };

    // Validate target rows
    if (config.targetRows < 100 || config.targetRows > 50000) {
      return NextResponse.json(
        { error: 'Target rows must be between 100 and 50000' },
        { status: 400 }
      );
    }

    const generationId = await startDataGeneration(params.id, config);
    
    return NextResponse.json({
      generationId,
      message: 'Data generation started successfully',
      config,
    });
  } catch (error: any) {
    console.error('Error starting data generation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start data generation' },
      { status: 500 }
    );
  }
}
