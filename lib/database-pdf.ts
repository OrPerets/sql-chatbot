import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";
import type { HomeworkSet } from "@/app/homework/types";

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

export async function generateDatabasePdf(tableData: Record<string, any[]>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Register Hebrew font
    const fontPath = path.join(process.cwd(), "fonts", "NotoSansHebrew-Regular.ttf");
    if (fs.existsSync(fontPath)) {
      doc.registerFont("NotoSansHebrew", fontPath);
    }
    const hebrewFont = fs.existsSync(fontPath) ? "NotoSansHebrew" : "Helvetica";

    // Title
    doc.font(hebrewFont).fontSize(20).text("מסד נתונים - תרגיל 3", { align: "right" });
    doc.moveDown();

    // Process each table
    Object.entries(TABLE_SCHEMAS).forEach(([tableName, schema]) => {
      // Table name
      doc.font(hebrewFont).fontSize(16).text(tableName, { align: "right" });
      doc.moveDown(0.5);

      // Column definitions
      doc.font(hebrewFont).fontSize(12).text("עמודות:", { align: "right" });
      doc.moveDown(0.3);
      
      schema.columns.forEach((column) => {
        const notes = column.notes ? ` - ${column.notes}` : "";
        doc
          .font(hebrewFont)
          .fontSize(11)
          .text(`• ${column.name} (${column.type})${notes}`, { align: "right" });
      });

      doc.moveDown(0.5);

      // Sample data
      doc.font(hebrewFont).fontSize(12).text("נתוני דוגמא:", { align: "right" });
      doc.moveDown(0.3);

      const rows = tableData[tableName] ?? [];
      if (!rows.length) {
        doc
          .font(hebrewFont)
          .fontSize(11)
          .fillColor("#666666")
          .text("אין נתוני דוגמא זמינים לטבלה זו.", { align: "right" });
        doc.fillColor("#000000");
      } else {
        // Show up to 5 sample rows
        rows.slice(0, 5).forEach((row, index) => {
          const cells = Object.entries(row)
            .map(([key, value]) => `${key}=${value}`)
            .join(", ");
          // Use Hebrew font since the label "דוגמא" is in Hebrew and data may contain Hebrew values
          doc
            .font(hebrewFont)
            .fontSize(10)
            .text(`דוגמא ${index + 1}: ${cells}`, {
              align: "right",
              lineGap: 2,
            });
        });

        if (rows.length > 5) {
          doc.moveDown(0.2);
          doc
            .font(hebrewFont)
            .fontSize(10)
            .fillColor("#666666")
            .text(`(+ ${rows.length - 5} שורות נוספות...)`, { align: "right" });
          doc.fillColor("#000000");
        }
      }

      doc.moveDown(1);
    });

    doc.end();
  });
}
