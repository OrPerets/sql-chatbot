import { NextResponse } from "next/server";
import {
  getSubmissionForStudent,
  listSubmissionSummaries,
} from "../../_mock/homeworkStore";

interface RouteParams {
  params: { setId: string };
}

export async function GET(request: Request, { params }: RouteParams) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");

  if (role === "builder") {
    const summaries = listSubmissionSummaries(params.setId);
    return NextResponse.json(summaries);
  }

  const studentId = searchParams.get("studentId") ?? "student-demo";
  const submission = getSubmissionForStudent(params.setId, studentId);
  if (!submission) {
    return NextResponse.json({ message: "Submission not found" }, { status: 404 });
  }
  return NextResponse.json(submission);
}
