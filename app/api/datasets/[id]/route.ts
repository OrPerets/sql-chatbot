import { NextResponse } from "next/server";
import { getDatasetById, deleteDataset, updateDataset } from "@/lib/datasets";

interface RouteParams {
  params: { id: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const dataset = await getDatasetById(params.id);
    if (!dataset) {
      return NextResponse.json({ message: "Dataset not found" }, { status: 404 });
    }
    return NextResponse.json(dataset);
  } catch (error) {
    console.error('Error fetching dataset:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dataset' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const body = await request.json();
    const dataset = await updateDataset(params.id, body);
    
    if (!dataset) {
      return NextResponse.json({ message: "Dataset not found" }, { status: 404 });
    }
    
    return NextResponse.json(dataset);
  } catch (error) {
    console.error('Error updating dataset:', error);
    return NextResponse.json(
      { error: 'Failed to update dataset' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const success = await deleteDataset(params.id);
    if (!success) {
      return NextResponse.json({ message: "Dataset not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Dataset deleted successfully" });
  } catch (error) {
    console.error('Error deleting dataset:', error);
    return NextResponse.json(
      { error: 'Failed to delete dataset' },
      { status: 500 }
    );
  }
}
