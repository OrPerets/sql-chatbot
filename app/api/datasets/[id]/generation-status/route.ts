import { NextResponse } from "next/server";
import { getDataGenerationService } from "@/lib/data-generation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const service = await getDataGenerationService();
    
    // Get all generation statuses for this dataset
    const allStatuses = Array.from(service['generationStatus'].values())
      .filter(status => status.datasetId === id)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    
    if (allStatuses.length === 0) {
      return NextResponse.json({
        message: 'No generation found for this dataset',
        statuses: []
      });
    }
    
    return NextResponse.json({
      datasetId: id,
      statuses: allStatuses
    });
  } catch (error: any) {
    console.error('Error fetching generation status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch generation status' },
      { status: 500 }
    );
  }
}

// Note: GET_GENERATION_ID was removed as it's not a valid Next.js route export
// If you need to get a specific generation by ID, use query parameters with the GET method
