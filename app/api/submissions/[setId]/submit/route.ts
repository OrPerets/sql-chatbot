import { NextResponse } from "next/server";
import { submitSubmission, getSubmissionForStudent } from "@/lib/submissions";
import { getHomeworkSetById } from "@/lib/homework";
import { findUserByIdOrEmail } from "@/lib/users";
import { sendEmail } from "@/app/utils/email-service";
import { getQuestionsByHomeworkSet } from "@/lib/questions";
import { generateSubmissionPdf } from "@/lib/submission-pdf";
import { isHomeworkAccessible } from "@/lib/deadline-utils";

interface RouteParams {
  params: Promise<{ setId: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { setId } = await params;
    const contentType = request.headers.get("content-type") ?? "";
    let finalStudentId: string | undefined;
    let aiCommitment: any = undefined;
    let aiConversationFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      finalStudentId = (formData.get("studentId") as string) ?? undefined;
      const commitmentRaw = formData.get("aiCommitment");
      if (typeof commitmentRaw === "string") {
        try {
          aiCommitment = JSON.parse(commitmentRaw);
        } catch (error) {
          console.error("Failed to parse aiCommitment", error);
        }
      }
      const uploaded = formData.get("aiConversation");
      if (uploaded instanceof File) {
        aiConversationFile = uploaded;
      }
    } else {
      const body = (await request.json()) as { studentId?: string; aiCommitment?: any };
      finalStudentId = body.studentId;
      aiCommitment = body.aiCommitment;
    }

    const finalStudentIdValue = finalStudentId ?? "student-demo";
    const commitmentPayload = aiCommitment
      ? {
          ...aiCommitment,
          timestamp: aiCommitment.timestamp ?? new Date().toISOString(),
          fileAttached: aiCommitment.fileAttached ?? aiConversationFile?.name,
        }
      : undefined;

    // Check deadline before allowing submission
    const homeworkSet = await getHomeworkSetById(setId);
    if (!homeworkSet) {
      return NextResponse.json({ message: "Homework set not found" }, { status: 404 });
    }

    // Get user email for deadline check
    let userEmail: string | null = null;
    if (finalStudentIdValue && finalStudentIdValue !== "student-demo") {
      try {
        const user = await findUserByIdOrEmail(finalStudentIdValue);
        if (user && user.email) {
          userEmail = user.email;
        }
      } catch (error) {
        console.warn("Could not lookup user for deadline check:", error);
      }
    }

    // Check if homework is still accessible
    if (!isHomeworkAccessible(homeworkSet.dueAt, userEmail)) {
      return NextResponse.json(
        { 
          error: "תאריך ההגשה חלף. שיעור הבית כבר לא זמין להגשה.",
          dueAt: homeworkSet.dueAt
        },
        { status: 403 }
      );
    }

    // Submit the homework
    const submission = await submitSubmission(setId, finalStudentIdValue, commitmentPayload);
    if (!submission) {
      return NextResponse.json({ message: "Submission not found" }, { status: 404 });
    }

    // Send confirmation email for all homework submissions
    try {
      // homeworkSet already fetched above, reuse it
      if (homeworkSet) {
        // Get student email - use submission.studentId (what's actually in DB) first
        // This handles cases where studentId was converted to ObjectId during submission
        let studentEmail: string | null = null;
        let user: any = null;
        
        // Try submission.studentId first (what's actually stored in DB)
        const studentIdToLookup = submission.studentId || finalStudentIdValue;
        
        // If studentId looks like an email, use it directly
        if (studentIdToLookup.includes("@")) {
          studentEmail = studentIdToLookup;
          // Still try to get user object for name
          user = await findUserByIdOrEmail(studentIdToLookup);
        } else {
          // Try to look up user by ID (ObjectId) or email using service
          // Try submission.studentId first (actual DB value)
          user = await findUserByIdOrEmail(studentIdToLookup);
          
          if (user && user.email) {
            studentEmail = user.email;
          } else {
            // Fallback: try original finalStudentIdValue if different
            if (finalStudentIdValue !== studentIdToLookup) {
              console.log(`⚠️ User not found with submission.studentId (${studentIdToLookup}), trying original (${finalStudentIdValue})...`);
              user = await findUserByIdOrEmail(finalStudentIdValue);
              if (user && user.email) {
                studentEmail = user.email;
              }
            }
            
            if (!studentEmail) {
              console.error(`❌ Could not find user email for studentId: ${studentIdToLookup} or ${finalStudentIdValue}, skipping email`);
              console.error(`   Submission ID: ${submission.id}, Homework Set: ${setId}`);
            }
          }
        }

        // Send email if we have a valid email
          if (studentEmail && studentEmail.includes("@")) {
            const homeworkTitle = homeworkSet.title || "שיעורי בית";
            const questions = await getQuestionsByHomeworkSet(setId);
            
            const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [];
            
            // Try to generate PDF, but don't fail if it doesn't work (serverless limitation)
            try {
              const pdfBuffer = await generateSubmissionPdf({
                submission,
                questions,
                homework: homeworkSet,
                studentName: user?.name,
              });
              
              attachments.push({
                filename: `submission-${submission.id}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
              });
            } catch (pdfError: any) {
              console.warn(`⚠️ PDF generation failed (${pdfError.message}), sending email without PDF attachment`);
              // Continue without PDF - email will still be sent with HTML content
            }

            if (aiConversationFile) {
              const buffer = Buffer.from(await aiConversationFile.arrayBuffer());
              attachments.push({
                filename: aiConversationFile.name || "ai-conversation.txt",
                content: buffer,
                contentType: aiConversationFile.type || "application/octet-stream",
              });
            }

            console.log(`📧 Attempting to send email to ${studentEmail} for submission ${submission.id}...`);
            const emailSent = await sendEmail({
              to: studentEmail,
              subject: `${homeworkTitle} הוגש בהצלחה - Michael SQL Assistant`,
              text: `${homeworkTitle} הוגש בהצלחה בקורס בסיסי נתונים.\n\nתודה על ההגשה!`,
              html: `
              <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #10b981;">${homeworkTitle} הוגש בהצלחה</h2>
                <p>שלום${user?.name ? ` ${user.name}` : ''},</p>
                <p>${homeworkTitle} הוגש בהצלחה בקורס בסיסי נתונים.</p>
                <p>ההגשה ננעלה ועפ״י תקנון שנקר, ואינה ניתנת לעריכה נוספת.</p>
                ${attachments.length > 0 ? '<p>הקובץ המצורף כולל את כל התשובות שנשלחו.</p>' : '<p>ניתן לראות את ההגשה במערכת.</p>'}
                <p>תודה על ההגשה!</p>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
                <p style="font-size: 12px; color: #666;">Michael SQL Assistant Team</p>
              </div>
            `,
              attachments,
            });
            
            if (emailSent) {
              console.log(`✅ Successfully sent submission confirmation email to ${studentEmail} (submission ${submission.id})`);
            } else {
              console.error(`❌ Failed to send email to ${studentEmail} (submission ${submission.id}) - sendEmail returned false`);
            }
          }
      }
    } catch (emailError) {
      // Don't fail the submission if email fails
      console.error("⚠️ Failed to send submission email:", emailError);
    }

    return NextResponse.json(submission);
  } catch (error) {
    console.error('Error submitting homework:', error);
    return NextResponse.json(
      { error: 'Failed to submit homework' },
      { status: 500 }
    );
  }
}
