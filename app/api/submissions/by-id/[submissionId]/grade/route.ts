import { NextResponse } from "next/server";
import { gradeSubmission } from "@/lib/submissions";

interface RouteParams {
  params: Promise<{ submissionId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  let submissionId: string | undefined;
  try {
    const resolved = await params;
    submissionId = resolved.submissionId;
    const payload = await request.json();
    
    console.log(`[API Grade] Received grade request for submission ${submissionId}`);
    
    // Log what we received
    if (payload.answers) {
      const answersWithNotes = Object.entries(payload.answers).filter(([_, ans]: [string, any]) => 
        ans.feedback?.instructorNotes?.trim()
      );
      console.log(`[API Grade] Payload contains ${answersWithNotes.length} answers with instructorNotes`);
      if (answersWithNotes.length > 0) {
        const sample = answersWithNotes[0];
        console.log(`[API Grade] Sample answer in payload:`, {
          questionId: sample[0],
          instructorNotes: (sample[1] as any).feedback?.instructorNotes?.substring(0, 100),
          score: (sample[1] as any).feedback?.score,
        });
      } else {
        console.warn(`[API Grade] ⚠️ WARNING: Payload has ${Object.keys(payload.answers).length} answers but NONE have instructorNotes!`);
        // Log all answers to see what we have
        Object.entries(payload.answers).forEach(([qId, ans]: [string, any]) => {
          console.log(`[API Grade] Answer ${qId}:`, {
            hasFeedback: !!ans.feedback,
            hasInstructorNotes: !!ans.feedback?.instructorNotes,
            instructorNotes: ans.feedback?.instructorNotes || "(empty)",
            hasAutoNotes: !!ans.feedback?.autoNotes,
            score: ans.feedback?.score,
          });
        });
      }
    }
    
    const updated = await gradeSubmission(submissionId, payload);
    if (!updated) {
      console.error(`[API Grade] gradeSubmission returned null for ${submissionId}`);
      return NextResponse.json({ message: "Submission not found" }, { status: 404 });
    }
    
    // Verify what was returned
    const returnedAnswersWithNotes = Object.entries(updated.answers || {}).filter(([_, ans]: [string, any]) => 
      ans.feedback?.instructorNotes?.trim()
    );
    console.log(`[API Grade] Successfully graded submission ${submissionId}: ${returnedAnswersWithNotes.length} answers with instructorNotes returned`);
    
    return NextResponse.json(updated);
  } catch (error) {
    console.error(`[API Grade] Error grading submission ${submissionId ?? "(unknown)"}:`, error);
    return NextResponse.json(
      { error: "Failed to grade submission", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
