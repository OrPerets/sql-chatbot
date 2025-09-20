import { NextResponse } from "next/server";
import { 
  listDatasets, 
  createDataset, 
  getUniqueTags 
} from "@/lib/datasets";
import type { Dataset } from "@/app/homework/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const tags = searchParams.get("tags")?.split(",").filter(Boolean) || undefined;
    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Number(searchParams.get("pageSize")) || 25;

    const result = await listDatasets({
      search,
      tags,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching datasets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch datasets' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const datasetData: Omit<Dataset, 'id' | 'updatedAt'> = {
      name: body.name ?? "Untitled dataset",
      description: body.description,
      scenario: body.scenario,
      story: body.story,
      connectionUri: "sandbox://datasets/" + (body.name?.toLowerCase().replace(/\s+/g, '-') ?? "untitled"),
      previewTables: body.previewTables || [],
      tags: body.tags ?? [],
    };

    const dataset = await createDataset(datasetData);
    return NextResponse.json(dataset, { status: 201 });
  } catch (error) {
    console.error('Error creating dataset:', error);
    return NextResponse.json(
      { error: 'Failed to create dataset' },
      { status: 500 }
    );
  }
}

// Get unique tags endpoint
export async function HEAD(request: Request) {
  try {
    const tags = await getUniqueTags();
    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}
