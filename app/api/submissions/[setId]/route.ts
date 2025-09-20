import { NextResponse } from "next/server";
import {
  getSubmissionForStudent,
  getSubmissionSummaries,
  saveSubmissionDraft,
  submitSubmission,
} from "@/lib/submissions";
import type { SaveSubmissionDraftPayload } from "@/app/homework/types";

interface RouteParams {
  params: { setId: string };
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");

    if (role === "builder") {
      const summaries = await getSubmissionSummaries(params.setId);
      return NextResponse.json(summaries);
    }

    const studentId = searchParams.get("studentId") ?? "student-demo";
    const submission = await getSubmissionForStudent(params.setId, studentId);
    if (!submission) {
      return NextResponse.json({ message: "Submission not found" }, { status: 404 });
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

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const body = await request.json();
    const { action, studentId, ...payload } = body;

    if (action === 'save_draft') {
      const submissionData: SaveSubmissionDraftPayload = {
        studentId: studentId || "student-demo",
        ...payload,
      };
      const submission = await saveSubmissionDraft(params.setId, submissionData);
      return NextResponse.json(submission);
    }

    if (action === 'submit') {
      const submission = await submitSubmission(params.setId, studentId || "student-demo");
      if (!submission) {
        return NextResponse.json({ message: "Submission not found" }, { status: 404 });
      }
      return NextResponse.json(submission);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error('Error processing submission:', error);
    return NextResponse.json(
      { error: 'Failed to process submission' },
      { status: 500 }
    );
  }
}
