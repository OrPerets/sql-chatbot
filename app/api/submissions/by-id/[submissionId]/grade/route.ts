import { NextResponse } from "next/server";
import { gradeSubmissionRecord } from "../../../../_mock/homeworkStore";

interface RouteParams {
  params: { submissionId: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  const payload = await request.json();
  const updated = gradeSubmissionRecord(params.submissionId, payload);
  if (!updated) {
    return NextResponse.json({ message: "Submission not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}
