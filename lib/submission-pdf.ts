import PDFDocument from "pdfkit";
import type { HomeworkSet, Question, Submission } from "@/app/homework/types";

interface PdfOptions {
  submission: Submission;
  questions: Question[];
  homework: HomeworkSet;
  studentName?: string;
}

export async function generateSubmissionPdf({
  submission,
  questions,
  homework,
  studentName,
}: PdfOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const title = homework.title || "מסד נתונים";

    doc.fontSize(20).text(`דו"ח הגשה - ${title}`, { align: "right" });
    doc.moveDown();

    doc
      .fontSize(12)
      .text(`סטודנט: ${studentName || submission.studentId}`, { align: "right" });
    doc
      .fontSize(12)
      .text(`מזהה סטודנט: ${submission.studentId}`, { align: "right" });
    doc.fontSize(12).text(`תאריך הגשה: ${submission.submittedAt ?? ""}`, { align: "right" });
    doc.moveDown();

    doc.fontSize(14).text("שאלות ותשובות", { align: "right" });
    doc.moveDown(0.5);

    questions.forEach((question, index) => {
      const answer = submission.answers?.[question.id];
      doc.fontSize(13).text(`שאלה ${index + 1}: ${question.prompt}`, { align: "right" });
      if (question.instructions) {
        doc
          .fontSize(11)
          .fillColor("#374151")
          .text(question.instructions, { align: "right" });
        doc.fillColor("#000000");
      }

      doc.moveDown(0.3);
      doc.fontSize(11).text("תשובה:", { align: "right" });
      doc
        .font("Courier")
        .fontSize(10)
        .text(answer?.sql || "לא ניתנה תשובה", {
          align: "right",
          lineGap: 2,
        });
      doc.font("Helvetica");

      doc.moveDown();
    });

    doc.end();
  });
}
