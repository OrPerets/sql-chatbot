import { NextResponse } from "next/server";
import {
  getHomeworkSetById,
  updateHomeworkSet,
  deleteHomeworkSet,
  publishHomeworkSet,
} from "@/lib/homework";
import { getHomeworkAvailabilityInfo } from "@/lib/deadline-utils";
import { getUsersService } from "@/lib/users";
import type { HomeworkSet } from "@/app/homework/types";

interface RouteParams {
  params: Promise<{ setId: string }>;
}

function isElevatedRole(role: string | null): boolean {
  return role === "builder" || role === "admin" || role === "instructor";
}

function buildStudentAccessContext(homeworkSet: HomeworkSet, userEmail: string | null) {
  const availability = getHomeworkAvailabilityInfo(homeworkSet, userEmail);

  return {
    published: homeworkSet.published,
    visibility: homeworkSet.visibility,
    entryMode: homeworkSet.entryMode ?? "listed",
    availabilityState: availability.availabilityState,
    availabilityMessage: availability.availabilityMessage,
    accessible: availability.accessible,
    availableFrom: homeworkSet.availableFrom,
    availableUntil: homeworkSet.availableUntil,
  };
}

function logStudentAccessDenied(
  setId: string,
  reason: "not-published" | "archived" | "hidden" | "availability-window",
  context: Record<string, unknown>,
) {
  console.warn("Student access denied for homework set", {
    setId,
    reason,
    ...context,
  });
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { setId } = await params;
    const homeworkSet = await getHomeworkSetById(setId);
    if (!homeworkSet) {
      return NextResponse.json({ message: "Homework set not found" }, { status: 404 });
    }

    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    const studentId = url.searchParams.get('studentId');
    const emailParam = url.searchParams.get('email');
    let userEmail: string | null = emailParam?.trim().toLowerCase() || null;

    if (!userEmail && studentId) {
      try {
        const usersService = await getUsersService();
        const user = await usersService.findUserByIdOrEmail(studentId);
        if (user && user.email) {
          userEmail = user.email;
        }
      } catch (error) {
        console.warn('Could not lookup user for availability check:', error);
      }
    }

    const elevated = isElevatedRole(role);
    const availability = getHomeworkAvailabilityInfo(homeworkSet, userEmail);
    const studentAccess = buildStudentAccessContext(homeworkSet, userEmail);

    if (!elevated) {
      if (!homeworkSet.published || homeworkSet.visibility === "archived" || homeworkSet.entryMode === "hidden") {
        const reason = !homeworkSet.published
          ? "not-published"
          : homeworkSet.visibility === "archived"
            ? "archived"
            : "hidden";
        logStudentAccessDenied(setId, reason, {
          role,
          studentId,
          userEmail,
          studentAccess,
        });
        return NextResponse.json(
          {
            error: "שיעור הבית אינו זמין לסטודנטים.",
            accessible: false,
            studentAccess,
          },
          { status: 403 },
        );
      }

      if (!availability.accessible) {
        logStudentAccessDenied(setId, "availability-window", {
          role,
          studentId,
          userEmail,
          studentAccess,
        });
        return NextResponse.json(
          {
            error: availability.availabilityMessage,
            dueAt: homeworkSet.dueAt,
            availableFrom: homeworkSet.availableFrom,
            availableUntil: homeworkSet.availableUntil,
            accessible: false,
            availabilityState: availability.availabilityState,
            studentAccess,
          },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({
      ...homeworkSet,
      ...availability,
      accessible: elevated ? true : availability.accessible,
      studentAccess,
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
    const { setId } = await params;
    const body = await request.json();
    const homeworkSet = await updateHomeworkSet(setId, body);
    
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
    const { setId } = await params;
    const success = await deleteHomeworkSet(setId);
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
    const { setId } = await params;
    const body = await request.json();
    const { published } = body;
    
    if (typeof published !== 'boolean') {
      return NextResponse.json(
        { error: 'Published field must be a boolean' },
        { status: 400 }
      );
    }
    
    const homeworkSet = await publishHomeworkSet(setId, published);
    
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
