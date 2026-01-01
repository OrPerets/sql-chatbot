import * as XLSX from "xlsx";
import type { Question, Submission } from "@/app/homework/types";

interface ExportHomeworkParams {
  homeworkTitle: string;
  questions: Question[];
  submissions: Submission[];
  fileName: string;
}

const formatScoreCell = (score: number | undefined) => {
  if (typeof score === "number") return score;
  if (score === 0) return 0;
  return "";
};

export function buildHomeworkGradesWorkbook({
  homeworkTitle,
  questions,
  submissions,
}: Omit<ExportHomeworkParams, "fileName">) {
  const headers: (string | number)[] = ["ת.ז", "שם"];

  questions.forEach((question, index) => {
    headers.push(`שאלה ${index + 1} (ניקוד)`);
    headers.push(`שאלה ${index + 1} (הערה)`);
  });

  headers.push('סה"כ');

  const rows = submissions.map((submission) => {
    const studentId = submission.studentId ?? "";
    const studentName = (submission as any).studentName ?? "";

    const row: (string | number)[] = [studentId, studentName];

    questions.forEach((question) => {
      const answer = submission.answers?.[question.id];
      row.push(formatScoreCell(answer?.feedback?.score));
      row.push(answer?.feedback?.instructorNotes ?? "");
    });

    const totalScore =
      typeof submission.overallScore === "number"
        ? submission.overallScore
        : questions.reduce((sum, question) => sum + (submission.answers?.[question.id]?.feedback?.score ?? 0), 0);

    row.push(totalScore);
    return row;
  });

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet["!cols"] = headers.map(() => ({ wch: 16 }));

  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { Views: [{ RTL: true }] } as any;
  workbook.Props = { Title: `${homeworkTitle} - ציונים` };
  XLSX.utils.book_append_sheet(workbook, worksheet, "ציונים");

  return workbook;
}

export function exportHomeworkGradesToExcel(params: ExportHomeworkParams) {
  const workbook = buildHomeworkGradesWorkbook(params);
  XLSX.writeFile(workbook, params.fileName);
}
