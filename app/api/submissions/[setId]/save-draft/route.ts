import { NextResponse } from "next/server";
import { saveSubmissionDraft } from "@/lib/submissions";

interface RouteParams {
  params: { setId: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const payload = await request.json();
    console.log('💾 Save draft called for setId:', params.setId, 'studentId:', payload.studentId);
    
    const submission = await saveSubmissionDraft(params.setId, payload);
    
    if (!submission) {
      console.error('❌ Save draft failed - no submission returned');
      return NextResponse.json({ message: "Submission not found" }, { status: 404 });
    }
    
    console.log('✅ Draft saved successfully');
    return NextResponse.json(submission);
  } catch (error: any) {
    console.error('❌ Error saving draft:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to save draft' },
      { status: 500 }
    );
  }
}
