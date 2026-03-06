import { NextResponse } from "next/server";
import { saveSubmissionDraft } from "@/lib/submissions";
import { getHomeworkSetById } from "@/lib/homework";
import { findUserByIdOrEmail } from "@/lib/users";
import { getHomeworkAvailabilityInfo, isHomeworkAccessible } from "@/lib/deadline-utils";

interface RouteParams {
  params: Promise<{ setId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { setId } = await params;
    const payload = await request.json();
    console.log('💾 Save draft called for setId:', setId, 'studentId:', payload.studentId);
    
    // Check deadline before allowing draft save
    const homeworkSet = await getHomeworkSetById(setId);
    if (!homeworkSet) {
      return NextResponse.json({ message: "Homework set not found" }, { status: 404 });
    }

    // Get user email for deadline check
    let userEmail: string | null = null;
    if (payload.studentId && payload.studentId !== "student-demo") {
      try {
        const user = await findUserByIdOrEmail(payload.studentId);
        if (user && user.email) {
          userEmail = user.email;
        }
      } catch (error) {
        console.warn("Could not lookup user for deadline check:", error);
      }
    }

    // Check if homework is still accessible
    const availability = getHomeworkAvailabilityInfo(homeworkSet, userEmail);
    if (!isHomeworkAccessible(homeworkSet, userEmail)) {
      return NextResponse.json(
        { 
          error: availability.availabilityMessage,
          dueAt: homeworkSet.dueAt,
          availableFrom: homeworkSet.availableFrom,
          availableUntil: homeworkSet.availableUntil,
          availabilityState: availability.availabilityState,
        },
        { status: 403 }
      );
    }
    
    const submission = await saveSubmissionDraft(setId, payload);
    
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
