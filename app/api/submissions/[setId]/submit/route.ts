import { NextResponse } from "next/server";
import { submitSubmissionRecord } from "../../../_mock/homeworkStore";

interface RouteParams {
  params: { setId: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  const { studentId } = (await request.json()) as { studentId?: string };
  const submission = submitSubmissionRecord(params.setId, studentId ?? "student-demo");
  if (!submission) {
    return NextResponse.json({ message: "Submission not found" }, { status: 404 });
  }
  return NextResponse.json(submission);
}
