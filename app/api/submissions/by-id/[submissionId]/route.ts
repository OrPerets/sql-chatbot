import { NextResponse } from "next/server";
import { getSubmissionById } from "@/lib/submissions";

interface RouteParams {
  params: { submissionId: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const submission = await getSubmissionById(params.submissionId);
    if (!submission) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    return NextResponse.json(submission);
  } catch (error) {
    console.error('Error fetching submission:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submission' },
      { status: 500 }
    );
  }
}
