import { NextResponse } from "next/server";
import { getSubmissionsService } from "@/lib/submissions";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: { setId: string };
}

type TableSchema = {
  columns: Array<{ name: string; type: string; notes?: string }>;
};

const TABLE_SCHEMAS: Record<string, TableSchema> = {
  Students: {
    columns: [
      { name: "StudentID", type: "INTEGER", notes: "Primary Key" },
      { name: "FirstName", type: "VARCHAR(100)" },
      { name: "LastName", type: "VARCHAR(100)" },
      { name: "BirthDate", type: "DATE" },
      { name: "City", type: "VARCHAR(100)" },
      { name: "Email", type: "VARCHAR(150)" },
    ],
  },
  Courses: {
    columns: [
      { name: "CourseID", type: "INTEGER", notes: "Primary Key" },
      { name: "CourseName", type: "VARCHAR(200)" },
      { name: "Credits", type: "INTEGER" },
      { name: "Department", type: "VARCHAR(200)" },
    ],
  },
  Lecturers: {
    columns: [
      { name: "LecturerID", type: "INTEGER", notes: "Primary Key" },
      { name: "FirstName", type: "VARCHAR(100)" },
      { name: "LastName", type: "VARCHAR(100)" },
      { name: "City", type: "VARCHAR(100)" },
      { name: "HireDate", type: "DATE" },
      { name: "CourseID", type: "INTEGER", notes: "Foreign Key → Courses.CourseID" },
      { name: "Seniority", type: "INTEGER" },
    ],
  },
  Enrollments: {
    columns: [
      { name: "StudentID", type: "INTEGER", notes: "Foreign Key → Students.StudentID" },
      { name: "CourseID", type: "INTEGER", notes: "Foreign Key → Courses.CourseID" },
      { name: "EnrollmentDate", type: "DATE" },
      { name: "Grade", type: "INTEGER" },
    ],
  },
};

const SAMPLE_TABLE_DATA: Record<string, any[]> = {
  Students: [
    { StudentID: 1, FirstName: "יעל", LastName: "כהן", BirthDate: "1999-03-15", City: "תל אביב", Email: "yael@example.com" },
    { StudentID: 2, FirstName: "דוד", LastName: "לוי", BirthDate: "2000-07-22", City: "חיפה", Email: "david@example.com" },
  ],
  Courses: [
    { CourseID: 101, CourseName: "מבוא למערכות מידע", Credits: 3, Department: "מערכות מידע" },
    { CourseID: 102, CourseName: "מסדי נתונים", Credits: 4, Department: "מדעי המחשב" },
  ],
  Lecturers: [
    { LecturerID: 1, FirstName: "משה", LastName: "אברהם", City: "תל אביב", HireDate: "2015-09-01", CourseID: 101, Seniority: 9 },
    { LecturerID: 2, FirstName: "רות", LastName: "בנימין", City: "חיפה", HireDate: "2018-03-15", CourseID: 102, Seniority: 6 },
  ],
  Enrollments: [
    { StudentID: 1, CourseID: 101, EnrollmentDate: "2024-09-01", Grade: 85 },
    { StudentID: 1, CourseID: 102, EnrollmentDate: "2024-09-01", Grade: 92 },
  ],
};

function escapePdfText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildContentLines(tableData: Record<string, any[]>): string[] {
  const lines: string[] = [];

  lines.push("מסד נתונים - תרגיל 3");
  lines.push("----------------------------------------");
  lines.push("");

  Object.entries(TABLE_SCHEMAS).forEach(([tableName, schema]) => {
    lines.push(`${tableName}`);
    lines.push("-----------------");

    lines.push("עמודות:");
    schema.columns.forEach((column) => {
      const notes = column.notes ? ` - ${column.notes}` : "";
      lines.push(`• ${column.name} (${column.type})${notes}`);
    });

    lines.push("");
    lines.push("נתוני דוגמא:");

    const rows = tableData[tableName] ?? [];
    if (!rows.length) {
      lines.push("אין נתוני דוגמא זמינים לטבלה זו.");
    } else {
      rows.slice(0, 5).forEach((row, index) => {
        const cells = Object.entries(row)
          .map(([key, value]) => `${key}=${value}`)
          .join(", ");
        lines.push(`דוגמא ${index + 1}: ${cells}`);
      });

      if (rows.length > 5) {
        lines.push(`(+ ${rows.length - 5} שורות נוספות...)`);
      }
    }

    lines.push("");
  });

  return lines.map(escapePdfText);
}

function buildPdfBuffer(lines: string[]): Buffer {
  const contentLines: string[] = [
    "BT",
    "/F1 18 Tf",
    "1 0 0 1 50 760 Tm",
    `(${lines[0]}) Tj`,
    "0 -28 Td",
    "/F1 12 Tf",
    "14 TL",
  ];

  lines.slice(1).forEach((line) => {
    contentLines.push(`(${line}) Tj`);
    contentLines.push("T*");
  });

  contentLines.push("ET");

  const contentStream = contentLines.join("\n");
  const contentLength = Buffer.byteLength(contentStream, "utf8");

  const header = "%PDF-1.4\n";

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
    `4 0 obj << /Length ${contentLength} >> stream\n${contentStream}\nendstream endobj\n`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
  ];

  const offsets: number[] = [];
  let position = header.length;
  objects.forEach((obj) => {
    offsets.push(position);
    position += Buffer.byteLength(obj, "utf8");
  });

  const xrefPosition = position;

  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    xref += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });

  const trailer = `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPosition}\n%%EOF`;

  const pdfString = header + objects.join("") + xref + trailer;
  return Buffer.from(pdfString, "utf8");
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId") ?? "student-demo";

    const submissionsService = await getSubmissionsService();
    const submission = await submissionsService.getSubmissionForStudent(params.setId, studentId);

    const tableData = submission?.studentTableData && Object.keys(submission.studentTableData).length > 0
      ? submission.studentTableData
      : SAMPLE_TABLE_DATA;

    const lines = buildContentLines(tableData);
    const pdfBuffer = buildPdfBuffer(lines);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="database-${params.setId}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Failed to generate database PDF", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate database PDF" },
      { status: 500 },
    );
  }
}
