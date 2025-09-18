import { NextResponse } from "next/server";
import { getSubmissionProgressById } from "../../../../_mock/homeworkStore";

interface RouteParams {
  params: { submissionId: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  const progress = getSubmissionProgressById(params.submissionId);
  if (!progress) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }
  return NextResponse.json(progress);
}
