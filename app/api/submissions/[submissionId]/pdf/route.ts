import { NextResponse } from "next/server";
import { getSubmissionById } from "@/lib/submissions";
import { getHomeworkSetById } from "@/lib/homework";
import { generateSubmissionPdf } from "@/lib/submission-pdf";

interface RouteParams {
  params: { submissionId: string };
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const submission = await getSubmissionById(params.submissionId);
    if (!submission) {
      return NextResponse.json({ message: "Submission not found" }, { status: 404 });
    }

    const homeworkSet = await getHomeworkSetById(submission.homeworkSetId);
    const pdfBuffer = generateSubmissionPdf(submission, homeworkSet, undefined);

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="submission-${submission.id}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Failed to generate submission PDF", error);
    return NextResponse.json({ message: "Failed to generate PDF" }, { status: 500 });
  }
}
