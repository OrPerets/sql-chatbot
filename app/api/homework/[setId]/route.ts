import { NextResponse } from "next/server";
import {
  getHomeworkSetById,
  updateHomeworkSet,
  deleteHomeworkSet,
  publishHomeworkSet,
} from "@/lib/homework";

interface RouteParams {
  params: { setId: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const homeworkSet = await getHomeworkSetById(params.setId);
    if (!homeworkSet) {
      return NextResponse.json({ message: "Homework set not found" }, { status: 404 });
    }
    return NextResponse.json(homeworkSet);
  } catch (error) {
    console.error('Error fetching homework set:', error);
    return NextResponse.json(
      { error: 'Failed to fetch homework set' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const body = await request.json();
    const homeworkSet = await updateHomeworkSet(params.setId, body);
    
    if (!homeworkSet) {
      return NextResponse.json({ message: "Homework set not found" }, { status: 404 });
    }
    
    return NextResponse.json(homeworkSet);
  } catch (error) {
    console.error('Error updating homework set:', error);
    return NextResponse.json(
      { error: 'Failed to update homework set' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const success = await deleteHomeworkSet(params.setId);
    if (!success) {
      return NextResponse.json({ message: "Homework set not found" }, { status: 404 });
    }
    return NextResponse.json({ message: "Homework set deleted successfully" });
  } catch (error) {
    console.error('Error deleting homework set:', error);
    return NextResponse.json(
      { error: 'Failed to delete homework set' },
      { status: 500 }
    );
  }
}

// Publish/unpublish endpoint
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const body = await request.json();
    const { published } = body;
    
    if (typeof published !== 'boolean') {
      return NextResponse.json(
        { error: 'Published field must be a boolean' },
        { status: 400 }
      );
    }
    
    const homeworkSet = await publishHomeworkSet(params.setId, published);
    
    if (!homeworkSet) {
      return NextResponse.json({ message: "Homework set not found" }, { status: 404 });
    }
    
    return NextResponse.json(homeworkSet);
  } catch (error) {
    console.error('Error publishing homework set:', error);
    return NextResponse.json(
      { error: 'Failed to publish homework set' },
      { status: 500 }
    );
  }
}