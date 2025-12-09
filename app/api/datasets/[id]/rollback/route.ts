import { NextResponse } from "next/server";
import { rollbackDataGeneration } from "@/lib/data-generation";

interface RouteParams {
  params: { id: string };
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const success = await rollbackDataGeneration(params.id);
    
    if (!success) {
      return NextResponse.json(
        { error: 'No generated data found to rollback' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      message: 'Dataset rolled back successfully',
      datasetId: params.id,
    });
  } catch (error: any) {
    console.error('Error rolling back dataset:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to rollback dataset' },
      { status: 500 }
    );
  }
}
