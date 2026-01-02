import * as XLSX from "xlsx";
import type { Question, Submission, SubmissionSummary } from "@/app/homework/types";

interface StudentData {
  studentIdNumber?: string; // ת.ז
  studentName?: string;
}

interface ExportHomeworkParams {
  homeworkTitle: string;
  questions: Question[];
  submissions: Submission[];
  summaries?: SubmissionSummary[]; // Optional summaries with enriched student data
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
  summaries,
}: Omit<ExportHomeworkParams, "fileName">) {
  const headers: (string | number)[] = ["ת.ז", "שם", "אימייל"];

  questions.forEach((question, index) => {
    headers.push(`שאלה ${index + 1} (ניקוד)`);
    headers.push(`שאלה ${index + 1} (הערה)`);
  });

  headers.push('סה"כ');

  // Create a map of studentId to enriched data from summaries
  const studentDataMap = new Map<string, StudentData>();
  if (summaries) {
    summaries.forEach(summary => {
      studentDataMap.set(summary.id, {
        studentIdNumber: summary.studentIdNumber,
        studentName: summary.studentName,
      });
    });
  }

  const rows = submissions.map((submission) => {
    const studentData = studentDataMap.get(submission.id);
    const studentIdNumber = studentData?.studentIdNumber ?? "";
    const studentName = studentData?.studentName ?? (submission as any).studentName ?? "";
    const email = submission.studentId ?? "";

    const row: (string | number)[] = [studentIdNumber, studentName, email];

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
  
  // Set column widths - wider for name and email columns
  const colWidths = [12, 20, 25]; // ת.ז, שם, אימייל
  questions.forEach(() => {
    colWidths.push(12, 25); // ניקוד, הערה
  });
  colWidths.push(10); // סה"כ
  worksheet["!cols"] = colWidths.map(wch => ({ wch }));

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
