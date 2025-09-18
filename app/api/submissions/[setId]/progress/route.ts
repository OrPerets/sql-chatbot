import { NextResponse } from "next/server";
import { getSubmissionProgressForStudent } from "../../../_mock/homeworkStore";

interface RouteParams {
  params: { setId: string };
}

export async function GET(request: Request, { params }: RouteParams) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId") ?? "student-demo";
  const progress = getSubmissionProgressForStudent(params.setId, studentId);
  if (!progress) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json(progress);
}
