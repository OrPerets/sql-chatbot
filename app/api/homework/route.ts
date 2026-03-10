import { NextResponse } from "next/server";
import {
  listHomeworkSets,
  createHomeworkSet,
} from "@/lib/homework";
import type { HomeworkSet } from "@/app/homework/types";
import { getHomeworkAvailabilityInfo } from "@/lib/deadline-utils";
import { getUsersService } from "@/lib/users";

function isElevatedRole(role: string | null): boolean {
  return role === "builder" || role === "admin" || role === "instructor";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.getAll("status");
    const courseId = searchParams.get("courseId") || undefined;
    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Number(searchParams.get("pageSize")) || 25;
    const role = searchParams.get("role");
    const onlyAvailable = searchParams.get("availableOnly") === "true";
    const studentId = searchParams.get("studentId");
    const emailParam = searchParams.get("email");
    let userEmail: string | null = emailParam?.trim().toLowerCase() || null;

    if (!userEmail && studentId) {
      try {
        const usersService = await getUsersService();
        const user = await usersService.findUserByIdOrEmail(studentId);
        userEmail = user?.email?.trim().toLowerCase() || null;
      } catch (error) {
        console.warn("Could not lookup user for availability check:", error);
      }
    }

    const result = await listHomeworkSets({
      courseId,
      status: status.length ? status : undefined,
      page,
      pageSize,
    });

    const includeHidden = isElevatedRole(role);
    const items = result.items
      .map((homeworkSet) => ({
        ...homeworkSet,
        ...getHomeworkAvailabilityInfo(homeworkSet, userEmail),
      }))
      .filter((homeworkSet) => {
        if (includeHidden) {
          return true;
        }

        if (!homeworkSet.published || homeworkSet.visibility === "archived") {
          return false;
        }

        if (homeworkSet.entryMode === "hidden") {
          return false;
        }

        if (onlyAvailable) {
          return homeworkSet.accessible;
        }

        return true;
      });

    return NextResponse.json({
      ...result,
      items,
      totalItems: items.length,
      totalPages: Math.ceil(items.length / pageSize) || 1,
    });
  } catch (error) {
    console.error('Error fetching homework sets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch homework sets' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    
    const homeworkData: Omit<HomeworkSet, 'id' | 'createdAt' | 'updatedAt'> = {
      title: payload.title || "Untitled Homework",
      courseId: payload.courseId || "",
      dueAt: payload.dueAt || payload.availableUntil || new Date().toISOString(),
      availableFrom: payload.availableFrom || new Date().toISOString(),
      availableUntil: payload.availableUntil || payload.dueAt || new Date().toISOString(),
      published: payload.published || false,
      entryMode: payload.entryMode || "listed",
      datasetPolicy: payload.datasetPolicy || "shared",
      questionOrder: payload.questionOrder || [],
      visibility: payload.visibility || "draft",
      createdBy: payload.createdBy || "instructor-1", // TODO: Get from auth
      overview: payload.overview,
      backgroundStory: payload.backgroundStory,
      selectedDatasetId: payload.selectedDatasetId,
      dataStructureNotes: payload.dataStructureNotes,
    };

    const created = await createHomeworkSet(homeworkData);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Error creating homework set:', error);
    return NextResponse.json(
      { error: 'Failed to create homework set' },
      { status: 500 }
    );
  }
}
