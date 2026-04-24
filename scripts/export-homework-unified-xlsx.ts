#!/usr/bin/env ts-node
/**
 * One Excel file, one sheet: every document for a homework set as rows
 * (record_type, record_id, json).
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/export-homework-unified-xlsx.ts <homeworkSetId>
 *   npx ts-node --project tsconfig.scripts.json scripts/export-homework-unified-xlsx.ts <id> --out ./exports
 *
 * Requires MONGODB_URI / DB_NAME like the app (dotenv loads .env).
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { connectToDatabase } from "../lib/database";
import { HomeworkExporter } from "./export-homework-1";

type UnifiedRow = {
  record_type: string;
  record_id: string;
  json: string;
};

function argValue(flag: string, fallback: string): string {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === "object" && (v as { constructor?: { name?: string } }).constructor?.name === "ObjectId") {
      return { $oid: String(v) };
    }
    if (v instanceof Date) {
      return { $date: v.toISOString() };
    }
    return v;
  });
}

function pickRecordId(doc: Record<string, unknown> | null | undefined): string {
  if (!doc || typeof doc !== "object") return "";
  const id = doc.id ?? doc._id ?? doc.submissionId ?? doc.eventId;
  if (id == null) return "";
  if (typeof id === "object" && id !== null && "$oid" in (id as object)) {
    return String((id as { $oid: string }).$oid);
  }
  return String(id);
}

function buildRows(data: Awaited<ReturnType<HomeworkExporter["exportHomeworkData"]>>): UnifiedRow[] {
  const rows: UnifiedRow[] = [];

  rows.push({
    record_type: "export_metadata",
    record_id: data.metadata.homeworkSetId,
    json: stableStringify({
      exportDate: data.metadata.exportDate,
      homeworkSetId: data.metadata.homeworkSetId,
      totalQuestions: data.metadata.totalQuestions,
      totalSubmissions: data.metadata.totalSubmissions,
      totalDatasets: data.metadata.totalDatasets,
    }),
  });

  if (data.homeworkSet) {
    rows.push({
      record_type: "homework_set",
      record_id: data.homeworkSet.id,
      json: stableStringify(data.homeworkSet),
    });
  }

  for (const q of data.questions) {
    rows.push({
      record_type: "question",
      record_id: q.id,
      json: stableStringify(q),
    });
  }

  for (const ds of data.datasets) {
    rows.push({
      record_type: "dataset",
      record_id: pickRecordId(ds),
      json: stableStringify(ds),
    });
  }

  for (const sub of data.submissions) {
    rows.push({
      record_type: "submission",
      record_id: pickRecordId(sub),
      json: stableStringify(sub),
    });
  }

  for (const ev of data.analytics) {
    rows.push({
      record_type: "analytics_event",
      record_id: pickRecordId(ev),
      json: stableStringify(ev),
    });
  }

  for (const t of data.templates) {
    rows.push({
      record_type: "question_template",
      record_id: pickRecordId(t),
      json: stableStringify(t),
    });
  }

  for (const iq of data.instantiatedQuestions) {
    rows.push({
      record_type: "instantiated_question",
      record_id: pickRecordId(iq),
      json: stableStringify(iq),
    });
  }

  for (const ar of data.analysisResults) {
    rows.push({
      record_type: "analysis_result",
      record_id: pickRecordId(ar),
      json: stableStringify(ar),
    });
  }

  return rows;
}

async function main(): Promise<void> {
  const homeworkId = process.argv[2];
  if (!homeworkId) {
    console.error(
      "Usage: npx ts-node --project tsconfig.scripts.json scripts/export-homework-unified-xlsx.ts <homeworkSetId> [--out dir]",
    );
    process.exit(1);
  }

  const outDir = argValue("--out", path.join(process.cwd(), "exports", "homework-unified"));
  fs.mkdirSync(outDir, { recursive: true });

  const { db } = await connectToDatabase();
  const exporter = new HomeworkExporter(db, outDir);

  const homeworkSet = await exporter.findHomeworkSet(homeworkId);
  if (!homeworkSet) {
    console.error(`Homework not found: ${homeworkId}`);
    process.exit(1);
  }

  console.log(`Exporting unified sheet for: ${homeworkSet.title} (${homeworkSet.id})`);
  const data = await exporter.exportHomeworkData(homeworkSet.id);
  const rows = buildRows(data);

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 22 }, { wch: 36 }, { wch: 120 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "hw_unified");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(outDir, `homework-${homeworkSet.id}-unified-${stamp}.xlsx`);
  XLSX.writeFile(wb, filePath);

  console.log(`Wrote ${filePath} (${rows.length} rows)`);
}

if (typeof require !== "undefined" && require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
