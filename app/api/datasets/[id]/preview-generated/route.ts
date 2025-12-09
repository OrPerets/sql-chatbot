import { NextResponse } from "next/server";
import { getDataGenerationService } from "@/lib/data-generation";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const service = await getDataGenerationService();
    
    // Get generated data from the service
    const generatedData = await service['db']
      .collection('generated_data')
      .findOne({ datasetId: params.id });
    
    if (!generatedData) {
      return NextResponse.json({
        message: 'No generated data found for this dataset',
        datasetId: params.id,
      });
    }
    
    // Return preview of generated data (first 5 rows from each table)
    const preview: { [tableName: string]: any[] } = {};
    
    for (const [tableName, tableData] of Object.entries(generatedData.data)) {
      if (Array.isArray(tableData)) {
        preview[tableName] = tableData.slice(0, 5); // First 5 rows
      }
    }
    
    return NextResponse.json({
      datasetId: params.id,
      totalTables: Object.keys(generatedData.data).length,
      totalRows: Object.values(generatedData.data).reduce((sum: number, tableData: any) => 
        sum + (Array.isArray(tableData) ? tableData.length : 0), 0),
      preview,
      generatedAt: generatedData.createdAt,
    });
  } catch (error: any) {
    console.error('Error fetching generated data preview:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch generated data preview' },
      { status: 500 }
    );
  }
}
