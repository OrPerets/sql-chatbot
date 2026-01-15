import { NextResponse } from "next/server";
import { getDatasetService } from "@/lib/datasets";

interface RouteParams {
  params: {
    id: string;
  };
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const body = await request.json();
    const { tableName, columns } = body;

    if (!tableName || !columns || columns.length === 0) {
      return NextResponse.json(
        { error: "Missing tableName or columns" },
        { status: 400 }
      );
    }

    // Get dataset
    const datasetService = await getDatasetService();
    const dataset = await datasetService.getDatasetById(params.id);

    if (!dataset) {
      return NextResponse.json(
        { error: "Dataset not found" },
        { status: 404 }
      );
    }

    // Generate CREATE TABLE SQL query
    const columnDefinitions = columns.map((col: { name: string; type: string }) => {
      let definition = `    ${col.name} ${col.type}`;
      return definition;
    });

    const createTableSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (\n${columnDefinitions.join(',\n')}\n);`;

    // For now, we'll store the CREATE TABLE SQL in the dataset metadata
    // In a real implementation, you would execute this against a SQL database
    // For SQL.js sandbox, the table will be created when the dataset is first used
    
    // Update dataset with table creation SQL
    const updatedDataset = await datasetService.updateDataset(params.id, {
      story: (dataset.story || '') + `\n\nTable Creation SQL:\n${createTableSQL}`,
    });

    return NextResponse.json({
      success: true,
      message: `Table ${tableName} creation SQL generated successfully`,
      sql: createTableSQL,
      dataset: updatedDataset,
    });
  } catch (error) {
    console.error("Error creating table:", error);
    return NextResponse.json(
      {
        error: "Failed to create table",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}



