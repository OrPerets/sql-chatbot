import { NextResponse } from "next/server";
import {
  listHomeworkSets,
  createHomeworkSet,
} from "@/lib/homework";
import type { HomeworkSet } from "@/app/homework/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.getAll("status");
    const courseId = searchParams.get("courseId") || undefined;
    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Number(searchParams.get("pageSize")) || 25;

    const result = await listHomeworkSets({
      courseId,
      status: status.length ? status : undefined,
      page,
      pageSize,
    });

    return NextResponse.json(result);
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
      dueAt: payload.dueAt || new Date().toISOString(),
      published: payload.published || false,
      datasetPolicy: payload.datasetPolicy || "shared",
      questionOrder: payload.questionOrder || [],
      visibility: payload.visibility || "draft",
      createdBy: payload.createdBy || "instructor-1", // TODO: Get from auth
      overview: payload.overview,
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
