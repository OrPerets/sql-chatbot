import { NextResponse } from "next/server";
import { submitSubmission, getSubmissionForStudent } from "@/lib/submissions";
import { getHomeworkSetById } from "@/lib/homework";
import { findUserByIdOrEmail } from "@/lib/users";
import { sendEmail } from "@/app/utils/email-service";
import { getQuestionsByHomeworkSet } from "@/lib/questions";
import { generateSubmissionPdf } from "@/lib/submission-pdf";

interface RouteParams {
  params: { setId: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
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

    // Submit the homework
    const submission = await submitSubmission(params.setId, finalStudentIdValue, commitmentPayload);
    if (!submission) {
      return NextResponse.json({ message: "Submission not found" }, { status: 404 });
    }

    // Send confirmation email for all homework submissions
    try {
      const homeworkSet = await getHomeworkSetById(params.setId);
      if (homeworkSet) {
        // Get student email - studentId might be email or ObjectId
        let studentEmail: string | null = null;
        let user: any = null;
        
        // If studentId looks like an email, use it directly
        if (finalStudentIdValue.includes("@")) {
          studentEmail = finalStudentIdValue;
        } else {
          // Try to look up user by ID (ObjectId) or email using service
          user = await findUserByIdOrEmail(finalStudentIdValue);
          
          if (user && user.email) {
            studentEmail = user.email;
          } else {
            console.log(`⚠️ Could not find user email for studentId: ${finalStudentIdValue}, skipping email`);
          }
        }

        // Send email if we have a valid email
          if (studentEmail && studentEmail.includes("@")) {
            const homeworkTitle = homeworkSet.title || "שיעורי בית";
            const questions = await getQuestionsByHomeworkSet(params.setId);
            const pdfBuffer = await generateSubmissionPdf({
              submission,
              questions,
              homework: homeworkSet,
              studentName: user?.name,
            });

            const attachments: Array<{ filename: string; content: Buffer; contentType?: string }> = [
              {
                filename: `submission-${submission.id}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
              },
            ];

            if (aiConversationFile) {
              const buffer = Buffer.from(await aiConversationFile.arrayBuffer());
              attachments.push({
                filename: aiConversationFile.name || "ai-conversation.txt",
                content: buffer,
                contentType: aiConversationFile.type || "application/octet-stream",
              });
            }

            await sendEmail({
              to: studentEmail,
              subject: `${homeworkTitle} הוגש בהצלחה - Michael SQL Assistant`,
              text: `${homeworkTitle} הוגש בהצלחה בקורס בסיסי נתונים.\n\nתודה על ההגשה!`,
              html: `
              <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #10b981;">${homeworkTitle} הוגש בהצלחה</h2>
                <p>שלום${user?.name ? ` ${user.name}` : ''},</p>
                <p>${homeworkTitle} הוגש בהצלחה בקורס בסיסי נתונים.</p>
                <p>ההגשה ננעלה ואינה ניתנת לעריכה נוספת.</p>
                <p>הקובץ המצורף כולל את כל התשובות שנשלחו.</p>
                <p>תודה על ההגשה!</p>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;">
                <p style="font-size: 12px; color: #666;">Michael SQL Assistant Team</p>
              </div>
            `,
              attachments,
            });
            console.log(`✅ Sent submission confirmation email to ${studentEmail}`);
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
