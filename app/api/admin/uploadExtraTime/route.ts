import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { AdminAuthError, requireAdmin } from "@/lib/admin-auth";
import { COLLECTIONS, executeWithRetry } from "@/lib/database";

type ParsedRow = {
  studentId: string;
  percentage: number;
};

function normalizeHeader(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function normalizeStudentId(value: unknown) {
  return String(value || "").trim();
}

function normalizePercentage(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const parsed = Number.parseFloat(String(value || "").trim().replace("%", ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseCsvRows(text: string): Array<Record<string, string>> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(",").map((cell) => normalizeHeader(cell));
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((cell) => cell.trim());
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = cells[index] || "";
      return row;
    }, {});
  });
}

async function parseWorkbookRows(file: File): Promise<Array<Record<string, unknown>>> {
  const extension = file.name.toLowerCase();

  if (extension.endsWith(".csv")) {
    return parseCsvRows(await file.text());
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await file.arrayBuffer()));
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return [];
  }

  const headerRow = worksheet.getRow(1);
  const headers = headerRow.values
    .slice(1)
    .map((value) => normalizeHeader(value));

  const rows: Array<Record<string, unknown>> = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const values = row.values.slice(1);
    const mapped = headers.reduce<Record<string, unknown>>((result, header, index) => {
      result[header] = values[index];
      return result;
    }, {});

    rows.push(mapped);
  });

  return rows;
}

function validateRows(rows: Array<Record<string, unknown>>) {
  const validRows: ParsedRow[] = [];
  let errors = 0;

  for (const row of rows) {
    const studentId = normalizeStudentId(row.ID);
    const percentage = normalizePercentage(row.PERCENTAGE);

    if (!studentId || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      errors += 1;
      continue;
    }

    validRows.push({
      studentId,
      percentage,
    });
  }

  return { validRows, errors };
}

export async function POST(request: Request) {
  try {
    const { email } = await requireAdmin(request);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    const parsedRows = await parseWorkbookRows(file);
    if (!parsedRows.length) {
      return NextResponse.json({ error: "הקובץ ריק או לא קריא." }, { status: 400 });
    }

    const { validRows, errors } = validateRows(parsedRows);
    if (!validRows.length) {
      return NextResponse.json({ error: "לא נמצאו רשומות תקינות להעלאה." }, { status: 400 });
    }

    const studentIds = validRows.map((row) => row.studentId);

    const summary = await executeWithRetry(async (db) => {
      const existingDocs = await db
        .collection(COLLECTIONS.EXTRA_TIME_ACCOMMODATIONS)
        .find(
          { studentId: { $in: studentIds } },
          { projection: { studentId: 1 } }
        )
        .toArray();

      const existingIds = new Set(existingDocs.map((doc) => String(doc.studentId)));
      const now = new Date();

      await db.collection(COLLECTIONS.EXTRA_TIME_ACCOMMODATIONS).bulkWrite(
        validRows.map((row) => ({
          updateOne: {
            filter: { studentId: row.studentId },
            update: {
              $set: {
                studentId: row.studentId,
                percentage: row.percentage,
                uploadedBy: email,
                sourceFile: file.name,
                updatedAt: now,
              },
              $setOnInsert: {
                createdAt: now,
              },
            },
            upsert: true,
          },
        }))
      );

      const inserted = validRows.filter((row) => !existingIds.has(row.studentId)).length;
      const updated = validRows.length - inserted;

      return {
        totalRecords: validRows.length,
        inserted,
        updated,
        errors,
      };
    });

    return NextResponse.json({
      message: "קובץ התאמות הזמן נטען ונשמר בהצלחה.",
      summary,
    });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.error("Error uploading extra time file:", error);
    return NextResponse.json({ error: "Failed to upload extra time file" }, { status: 500 });
  }
}
