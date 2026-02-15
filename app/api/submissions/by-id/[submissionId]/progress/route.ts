import { NextResponse } from "next/server";
import { getSubmissionProgress } from "@/lib/submissions";

interface RouteParams {
  params: Promise<{ submissionId: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { submissionId } = await params;
    const progress = await getSubmissionProgress(submissionId);
    if (!progress) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }
    return NextResponse.json(progress);
  } catch (error) {
    console.error('Error fetching submission progress:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submission progress' },
      { status: 500 }
    );
  }
}
