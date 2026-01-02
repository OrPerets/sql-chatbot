import type { HomeworkSet, Submission } from "@/app/homework/types";

function escapePdfText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/\r?\n/g, " ");
}

function buildContentLines(submission: Submission, homeworkTitle?: string, studentName?: string) {
  const lines: string[] = [];
  lines.push(homeworkTitle ? `כותרת: ${homeworkTitle}` : "הגשה");
  lines.push(`תלמיד: ${studentName || submission.studentId}`);
  lines.push(`מזהה הגשה: ${submission.id}`);
  lines.push(`תאריך: ${submission.submittedAt || new Date().toISOString()}`);
  lines.push(" ");
  lines.push("תשובות:");

  Object.entries(submission.answers || {}).forEach(([questionId, answer]) => {
    lines.push(`שאלה ${questionId}`);
    const sql = answer?.sql ? answer.sql.trim() : "(לא נמסרה תשובה)";
    lines.push(sql);
    lines.push(" ");
  });

  if (lines.length === 0) {
    lines.push("לא נמצאו תשובות להגשה זו.");
  }

  return lines;
}

export function generateSubmissionPdf(
  submission: Submission,
  homework?: HomeworkSet | null,
  studentName?: string,
): Buffer {
  const lines = buildContentLines(submission, homework?.title, studentName);
  const textStreamLines = [
    "BT",
    "/F1 12 Tf",
    "14 TL",
    "1 0 0 1 50 750 Tm",
  ];

  lines.forEach((line) => {
    textStreamLines.push(`(${escapePdfText(line)}) Tj`);
    textStreamLines.push("T*");
  });

  textStreamLines.push("ET");
  const textStream = textStreamLines.join("\n");

  const objects: string[] = [];
  const addObject = (content: string) => {
    objects.push(content);
    return objects.length;
  };

  addObject("<< /Type /Catalog /Pages 2 0 R >>");
  addObject("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  addObject(
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  );
  addObject(`<< /Length ${textStream.length} >>\nstream\n${textStream}\nendstream`);
  addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  let offset = "%PDF-1.4\n%âãÏÓ\n".length;
  const parts: string[] = ["%PDF-1.4\n%âãÏÓ\n"];
  const xrefOffsets = [0];

  objects.forEach((obj, index) => {
    const objString = `${index + 1} 0 obj\n${obj}\nendobj\n`;
    xrefOffsets.push(offset);
    parts.push(objString);
    offset += objString.length;
  });

  const xrefStart = offset;
  const xrefParts = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...xrefOffsets.slice(1).map((off) => `${off.toString().padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>",
    "startxref",
    `${xrefStart}`,
    "%%EOF",
  ];

  parts.push(xrefParts.join("\n") + "\n");
  return Buffer.from(parts.join(""), "binary");
}
