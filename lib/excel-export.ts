import ExcelJS from "exceljs";
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

interface GenerateHomeworkGradesBufferParams
  extends Omit<ExportHomeworkParams, "fileName"> {
  emailMap?: Map<string, string> | Record<string, string>;
  fileName?: string;
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

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "sql-chatbot";
  workbook.title = `${homeworkTitle} - ציונים`;
  workbook.views = [{ rightToLeft: true }];

  const worksheet = workbook.addWorksheet("ציונים", {
    views: [{ rightToLeft: true }],
  });
  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));

  // Set column widths - wider for name and email columns
  const colWidths = [12, 20, 25]; // ת.ז, שם, אימייל
  questions.forEach(() => {
    colWidths.push(12, 25); // ניקוד, הערה
  });
  colWidths.push(10); // סה"כ
  worksheet.columns = colWidths.map((wch) => ({ width: wch }));

  return workbook;
}

export async function exportHomeworkGradesToExcel(params: ExportHomeworkParams) {
  const workbook = buildHomeworkGradesWorkbook(params);
  const fileBuffer = await workbook.xlsx.writeBuffer();
  if (typeof window === "undefined") {
    await workbook.xlsx.writeFile(params.fileName);
    return;
  }

  const blob = new Blob([fileBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = params.fileName;
  link.click();
  URL.revokeObjectURL(link.href);
}

const resolveEmailFromMap = (
  emailMap: Map<string, string> | Record<string, string> | undefined,
  studentId: string | undefined,
) => {
  if (!emailMap || !studentId) return undefined;
  if (emailMap instanceof Map) {
    return emailMap.get(studentId);
  }
  return emailMap[studentId];
};

export async function generateHomeworkGradesExcelBuffer({
  homeworkTitle,
  questions,
  submissions,
  summaries,
  emailMap,
}: GenerateHomeworkGradesBufferParams) {
  const normalizedSubmissions = submissions.map((submission) => {
    const resolvedEmail = resolveEmailFromMap(emailMap, submission.studentId);
    return {
      ...submission,
      studentId: resolvedEmail ?? submission.studentId,
    };
  });

  const workbook = buildHomeworkGradesWorkbook({
    homeworkTitle,
    questions,
    submissions: normalizedSubmissions,
    summaries,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}
