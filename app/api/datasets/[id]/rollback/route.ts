import { NextResponse } from "next/server";
import { rollbackDataGeneration } from "@/lib/data-generation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const success = await rollbackDataGeneration(id);
    
    if (!success) {
      return NextResponse.json(
        { error: 'No generated data found to rollback' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      message: 'Dataset rolled back successfully',
      datasetId: id,
    });
  } catch (error: any) {
    console.error('Error rolling back dataset:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to rollback dataset' },
      { status: 500 }
    );
  }
}
