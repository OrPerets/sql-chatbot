import { NextResponse } from "next/server";
import {
  getHomeworkSetById,
  updateHomeworkSet,
  deleteHomeworkSet,
  publishHomeworkSet,
} from "@/lib/homework";
import { isHomeworkAccessible } from "@/lib/deadline-utils";
import { getUsersService } from "@/lib/users";

interface RouteParams {
  params: { setId: string };
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const homeworkSet = await getHomeworkSetById(params.setId);
    if (!homeworkSet) {
      return NextResponse.json({ message: "Homework set not found" }, { status: 404 });
    }

    // Check deadline if studentId is provided in query params
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    const studentId = url.searchParams.get('studentId');
    const emailParam = url.searchParams.get('email');
    let userEmail: string | null = null;

    // Skip deadline check for builders - they should always have access
    if (role !== 'builder') {
      // Prefer email from query param if provided (more reliable for deadline extensions)
      if (emailParam) {
        userEmail = emailParam.trim().toLowerCase();
      } else if (studentId) {
        try {
          const usersService = await getUsersService();
          const user = await usersService.findUserByIdOrEmail(studentId);
          if (user && user.email) {
            userEmail = user.email;
          }
        } catch (error) {
          // If user lookup fails, continue without email (will use standard deadline)
          console.warn('Could not lookup user for deadline check:', error);
        }
      }

      // Check if homework is still accessible
      if (!isHomeworkAccessible(homeworkSet.dueAt, userEmail)) {
        return NextResponse.json(
          { 
            error: "תאריך ההגשה חלף. שיעור הבית כבר לא זמין להגשה.",
            dueAt: homeworkSet.dueAt,
            accessible: false
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      ...homeworkSet,
      accessible: true
    });
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