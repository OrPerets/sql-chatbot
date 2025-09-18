import { NextResponse } from "next/server";
import { saveSubmissionDraftRecord, type SaveSubmissionDraftPayload } from "../../../_mock/homeworkStore";

interface RouteParams {
  params: { setId: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  const payload = (await request.json()) as SaveSubmissionDraftPayload;
  const submission = saveSubmissionDraftRecord(params.setId, payload);
  if (!submission) {
    return NextResponse.json({ message: "Submission not found" }, { status: 404 });
  }
  return NextResponse.json(submission);
}
