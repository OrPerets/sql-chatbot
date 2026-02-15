import { NextResponse } from "next/server";
import { getDatasetById, deleteDataset, updateDataset } from "@/lib/datasets";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const dataset = await getDatasetById(id);
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
    const { id } = await params;
    const body = await request.json();
    const dataset = await updateDataset(id, body);
    
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
    const { id } = await params;
    const success = await deleteDataset(id);
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
