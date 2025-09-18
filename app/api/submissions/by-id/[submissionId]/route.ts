import { NextResponse } from "next/server";
import { getSubmissionById } from "../../../_mock/homeworkStore";

interface RouteParams {
  params: { submissionId: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const submission = getSubmissionById(params.submissionId);
  if (!submission) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json(submission);
}
