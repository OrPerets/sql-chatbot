import { NextResponse } from "next/server";
import { submitSubmission, getSubmissionForStudent } from "@/lib/submissions";
import { getHomeworkSetById } from "@/lib/homework";
import { getUsersService } from "@/lib/users";
import { sendEmail } from "@/app/utils/email-service";
import { connectToDatabase, COLLECTIONS } from "@/lib/database";
import { ObjectId } from "mongodb";
import { generateSubmissionPdf } from "@/lib/submission-pdf";
import type { Submission } from "@/app/homework/types";

interface RouteParams {
  params: { setId: string };
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let finalStudentId = "student-demo";
    let aiCommitment: Submission["aiCommitment"] | undefined;
    let aiAttachment: { filename: string; content: Buffer; contentType?: string } | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const studentField = formData.get("studentId");
      const confirmedField = formData.get("aiConfirmed");
      const aiFile = formData.get("aiFile");

      finalStudentId = typeof studentField === "string" && studentField.length > 0 ? studentField : "student-demo";
      const timestamp = new Date().toISOString();
      const signed = confirmedField === "true";

      if (aiFile instanceof File) {
        const buffer = Buffer.from(await aiFile.arrayBuffer());
        aiAttachment = {
          filename: aiFile.name || "ai-conversation.txt",
          content: buffer,
          contentType: aiFile.type || undefined,
        };

        aiCommitment = {
          signed: true,
          fileName: aiFile.name,
          attachmentBase64: buffer.toString("base64"),
          timestamp,
        };
      } else if (signed) {
        aiCommitment = {
          signed: true,
          timestamp,
        };
      }
    } else {
      const { studentId, aiConfirmed } = (await request.json()) as { studentId?: string; aiConfirmed?: boolean };
      finalStudentId = studentId ?? "student-demo";
      if (aiConfirmed) {
        aiCommitment = {
          signed: true,
          timestamp: new Date().toISOString(),
        };
      }
    }

    // Submit the homework
    const submission = await submitSubmission(params.setId, finalStudentId, aiCommitment);
    if (!submission) {
      return NextResponse.json({ message: "Submission not found" }, { status: 404 });
    }

    // Send confirmation email for all homework submissions
    try {
      const homeworkSet = await getHomeworkSetById(params.setId);
      if (homeworkSet) {
        // Get student email - studentId might be email or ObjectId
        let studentEmail: string | null = null;
        
        // If studentId looks like an email, use it directly
        if (finalStudentId.includes("@")) {
          studentEmail = finalStudentId;
        } else {
          // Try to look up user by ID (ObjectId) or email
          const { db } = await connectToDatabase();
          let user = null;
          
          // First, try to find by ObjectId if it's a valid ObjectId
          if (ObjectId.isValid(finalStudentId)) {
            user = await db.collection(COLLECTIONS.USERS).findOne({ 
              $or: [
                { _id: new ObjectId(finalStudentId) },
                { id: finalStudentId }
              ]
            });
          }
          
          // If not found by ObjectId, try by email
          if (!user) {
            user = await db.collection(COLLECTIONS.USERS).findOne({ email: finalStudentId });
          }
          
          // If still not found, try by id field
          if (!user) {
            user = await db.collection(COLLECTIONS.USERS).findOne({ id: finalStudentId });
          }
          
          if (user && user.email) {
            studentEmail = user.email;
          } else {
            console.log(`⚠️ Could not find user email for studentId: ${finalStudentId}, skipping email`);
          }
        }

        // Send email if we have a valid email
        if (studentEmail && studentEmail.includes("@")) {
          const homeworkTitle = homeworkSet.title || "שיעורי בית";
          const submissionPdf = generateSubmissionPdf(submission, homeworkSet, undefined);

          const attachments = [
            {
              filename: `submission-${submission.id}.pdf`,
              content: submissionPdf,
              contentType: "application/pdf",
            },
          ];

          if (aiAttachment) {
            attachments.push(aiAttachment);
          }

          await sendEmail({
            to: studentEmail,
            subject: `${homeworkTitle} הוגש בהצלחה - Michael SQL Assistant`,
            text: `${homeworkTitle} הוגש בהצלחה בקורס בסיסי נתונים.\n\nתודה על ההגשה!`,
            html: `
              <div dir=\"rtl\" style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;\">\n                <h2 style=\"color: #10b981;\">${homeworkTitle} הוגש בהצלחה</h2>\n                <p>שלום,</p>\n                <p>${homeworkTitle} הוגש בהצלחה בקורס בסיסי נתונים.</p>\n                <p>ההגשה ננעלה ואינה ניתנת לעריכה נוספת.</p>\n                <p>תודה על ההגשה!</p>\n                <hr style=\"margin: 20px 0; border: none; border-top: 1px solid #e2e8f0;\">\n                <p style=\"font-size: 12px; color: #666;\">Michael SQL Assistant Team</p>\n              </div>
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
