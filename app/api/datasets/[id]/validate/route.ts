import { NextResponse } from "next/server";
import { validateGeneratedData } from "@/lib/data-generation";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const validation = await validateGeneratedData(params.id);
    
    return NextResponse.json({
      datasetId: params.id,
      ...validation,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error validating dataset:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to validate dataset' },
      { status: 500 }
    );
  }
}
