import { NextResponse } from "next/server";
import { getSubmissionById } from "@/lib/submissions";
import { getHomeworkSetById } from "@/lib/homework";
import { getQuestionsByHomeworkSet } from "@/lib/questions";
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

    const homework = await getHomeworkSetById(submission.homeworkSetId);
    if (!homework) {
      return NextResponse.json({ message: "Homework not found" }, { status: 404 });
    }

    const questions = await getQuestionsByHomeworkSet(submission.homeworkSetId);
    const pdfBuffer = await generateSubmissionPdf({
      submission,
      questions,
      homework,
    });

    return new NextResponse(pdfBuffer, {
      status: 200,
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
