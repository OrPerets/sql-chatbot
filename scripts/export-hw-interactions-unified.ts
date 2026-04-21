#!/usr/bin/env ts-node
/**
 * Export all homework interaction data from MongoDB into one Excel workbook (multiple sheets)
 * or a folder of CSV files.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/export-hw-interactions-unified.ts
 *   npx ts-node --project tsconfig.scripts.json scripts/export-hw-interactions-unified.ts --format csv
 *   npx ts-node --project tsconfig.scripts.json scripts/export-hw-interactions-unified.ts --include-student-table-data
 *
 * Requires MONGODB_URI (and DB_NAME if not default) in the environment, same as the app.
 */

import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import ExcelJS from "exceljs";
import { connectToDatabase, COLLECTIONS } from "../lib/database";
import type { QuestionAnalyticsModel } from "../lib/models";

type Row = Record<string, string | number | boolean | null>;

function argFlag(name: string): boolean {
  return process.argv.includes(name);
}

function argValue(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function toIso(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return String(value);
}

function jsonCell(value: unknown): string {
  if (value == null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(rows: Row[]): string {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]!);
  const lines = [keys.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(keys.map((k) => csvEscape(row[k] ?? "")).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function buildHomeworkSetsRows(docs: any[]): Row[] {
  return docs.map((h) => ({
    id: h.id ?? "",
    title: h.title ?? "",
    course_id: h.courseId ?? "",
    due_at: h.dueAt ?? "",
    published: Boolean(h.published),
    visibility: h.visibility ?? "",
    created_at: h.createdAt ?? "",
    updated_at: h.updatedAt ?? "",
  }));
}

function buildSubmissionAnswerRows(submissions: any[], includeStudentTableData: boolean): Row[] {
  const rows: Row[] = [];
  for (const sub of submissions) {
    const base: Row = {
      mongo_id: sub._id?.toString?.() ?? "",
      submission_id: sub.id ?? "",
      homework_set_id: sub.homeworkSetId ?? "",
      student_id: sub.studentId ?? "",
      attempt_number: sub.attemptNumber ?? "",
      submission_status: sub.status ?? "",
      overall_score: sub.overallScore ?? "",
      submitted_at: sub.submittedAt ?? "",
      graded_at: sub.gradedAt ?? "",
      created_at: sub.createdAt ?? "",
      updated_at: sub.updatedAt ?? "",
      ai_commitment_signed: sub.aiCommitment?.signed ?? "",
      ai_commitment_timestamp: sub.aiCommitment?.timestamp ?? "",
      ai_commitment_declared_no_ai: sub.aiCommitment?.declaredNoAi ?? "",
    };
    if (includeStudentTableData && sub.studentTableData) {
      base.student_table_data_json = jsonCell(sub.studentTableData);
    }

    const answers = sub.answers && typeof sub.answers === "object" ? sub.answers : {};
    const qids = Object.keys(answers);
    if (qids.length === 0) {
      rows.push({
        ...base,
        question_id: "",
        answer_sql: "",
        answer_expression: "",
        execution_count: "",
        last_executed_at: "",
        feedback_score: "",
        feedback_auto_notes: "",
        feedback_instructor_notes: "",
        result_columns_json: "",
        result_row_count: "",
        result_execution_ms: "",
        result_truncated: "",
      });
      continue;
    }
    for (const qid of qids) {
      const a = answers[qid] as any;
      const preview = a?.resultPreview;
      rows.push({
        ...base,
        question_id: qid,
        answer_sql: a?.sql ?? "",
        answer_expression: a?.expression ?? "",
        execution_count: a?.executionCount ?? "",
        last_executed_at: a?.lastExecutedAt ?? "",
        feedback_score: a?.feedback?.score ?? "",
        feedback_auto_notes: a?.feedback?.autoNotes ?? "",
        feedback_instructor_notes: a?.feedback?.instructorNotes ?? "",
        result_columns_json: preview?.columns ? jsonCell(preview.columns) : "",
        result_row_count: Array.isArray(preview?.rows) ? preview.rows.length : "",
        result_execution_ms: preview?.executionMs ?? "",
        result_truncated: preview?.truncated ?? "",
      });
    }
  }
  return rows;
}

function buildQuestionAnalyticsRows(docs: QuestionAnalyticsModel[]): Row[] {
  return docs.map((qa) => {
    const m = qa.metrics;
    const g = m?.generalAnalysis;
    return {
      mongo_id: (qa as any)._id?.toString?.() ?? "",
      record_id: qa.id ?? "",
      submission_id: qa.submissionId ?? "",
      question_id: qa.questionId ?? "",
      student_id: qa.studentId ?? "",
      homework_set_id: qa.homeworkSetId ?? "",
      created_at: qa.createdAt ?? "",
      updated_at: qa.updatedAt ?? "",
      time_spent: m?.timeSpent ?? "",
      typing_speed: m?.typingSpeed ?? "",
      attempts: m?.attempts ?? "",
      time_to_first_execution: m?.timeToFirstExecution ?? "",
      characters_typed: m?.charactersTyped ?? "",
      edits_count: m?.editsCount ?? "",
      copy_paste_count: m?.copyPasteCount ?? "",
      show_answer_clicks: m?.showAnswerClicks ?? "",
      time_to_first_show_answer: m?.timeToFirstShowAnswer ?? "",
      time_between_executions_json: m?.timeBetweenExecutions ? jsonCell(m.timeBetweenExecutions) : "",
      query_execution_times_json: m?.queryExecutionTimes ? jsonCell(m.queryExecutionTimes) : "",
      show_answer_timings_json: m?.showAnswerTimings ? jsonCell(m.showAnswerTimings) : "",
      hints_used: g?.hintsUsed ?? "",
      confidence: g?.confidence ?? "",
      general_analysis_summary: g?.summary ?? "",
      ai_assistance_used: g?.aiAssistanceUsed ?? "",
      ai_assistance_notes: g?.aiAssistanceNotes ?? "",
      started_at: m?.startedAt ?? "",
      last_activity_at: m?.lastActivityAt ?? "",
    };
  });
}

function buildAnalyticsEventRows(docs: any[]): Row[] {
  return docs.map((ev) => ({
    mongo_id: ev._id?.toString?.() ?? "",
    id: ev.id ?? "",
    type: ev.type ?? ev.eventType ?? "",
    actor_id: ev.actorId ?? "",
    set_id: ev.setId ?? "",
    question_id: ev.questionId ?? "",
    submission_id: ev.submissionId ?? "",
    created_at: toIso(ev.createdAt ?? ev.timestamp),
    metadata_json: ev.metadata ? jsonCell(ev.metadata) : "",
  }));
}

function buildAuditRows(docs: any[]): Row[] {
  return docs.map((a) => ({
    mongo_id: a._id?.toString?.() ?? "",
    id: a.id ?? "",
    actor_id: a.actorId ?? "",
    action: a.action ?? "",
    target_id: a.targetId ?? "",
    target_type: a.targetType ?? "",
    created_at: a.createdAt ?? "",
    metadata_json: a.metadata ? jsonCell(a.metadata) : "",
  }));
}

function buildInstantiatedQuestionRows(docs: any[]): Row[] {
  return docs.map((q) => ({
    mongo_id: q._id?.toString?.() ?? "",
    id: q.id ?? "",
    template_id: q.templateId ?? "",
    student_id: q.studentId ?? "",
    homework_set_id: q.homeworkSetId ?? "",
    created_at: q.createdAt ?? "",
    variables_json: q.variables ? jsonCell(q.variables) : "",
  }));
}

function buildAnalysisResultRows(docs: any[]): Row[] {
  return docs.map((r) => ({
    mongo_id: r._id?.toString?.() ?? "",
    id: r.id ?? "",
    submission_id: r.submissionId ?? "",
    student_id: r.studentId ?? "",
    homework_set_id: r.homeworkSetId ?? "",
    analysis_type: r.analysisType ?? "",
    status: r.status ?? "",
    confidence: r.confidence ?? "",
    processing_time_ms: r.metadata?.processingTimeMs ?? "",
    model_used: r.metadata?.modelUsed ?? "",
    prompt_version: r.metadata?.promptVersion ?? "",
    metadata_created_at: r.metadata?.createdAt ?? "",
    metadata_completed_at: r.metadata?.completedAt ?? "",
    results_json: r.results ? jsonCell(r.results) : "",
  }));
}

function buildStudentActivityHomeworkRows(docs: any[]): Row[] {
  return docs.map((a) => ({
    mongo_id: a._id?.toString?.() ?? "",
    user_id: a.userId ?? "",
    activity_type: a.activityType ?? "",
    timestamp: toIso(a.timestamp),
    session_id: a.sessionId ?? "",
    activity_data_json: a.activityData ? jsonCell(a.activityData) : "",
  }));
}

function addSheetFromRows(
  workbook: ExcelJS.Workbook,
  name: string,
  rows: Row[],
): void {
  const sheet = workbook.addWorksheet(name.substring(0, 31), {
    views: [{ rightToLeft: false }],
  });
  if (rows.length === 0) {
    sheet.addRow(["(no data)"]);
    return;
  }
  const keys = Object.keys(rows[0]!);
  sheet.addRow(keys);
  for (const row of rows) {
    sheet.addRow(keys.map((k) => row[k] ?? ""));
  }
  sheet.getRow(1).font = { bold: true };
}

async function main(): Promise<void> {
  const format = argValue("--format", "xlsx").toLowerCase();
  const outDir = argValue("--out", path.join(process.cwd(), "exports", "hw-interactions"));
  const includeStudentTableData = argFlag("--include-student-table-data");

  if (format !== "xlsx" && format !== "csv") {
    console.error('Use --format xlsx or --format csv');
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  const { db } = await connectToDatabase();
  console.log("Connected. Loading collections (full export)...");

  const [
    homeworkSets,
    submissions,
    questionAnalytics,
    analyticsEvents,
    auditLogs,
    instantiatedQuestions,
    analysisResults,
    studentActivitiesHomework,
  ] = await Promise.all([
    db.collection(COLLECTIONS.HOMEWORK_SETS).find({}).toArray(),
    db.collection(COLLECTIONS.SUBMISSIONS).find({}).toArray(),
    db.collection<QuestionAnalyticsModel>(COLLECTIONS.QUESTION_ANALYTICS).find({}).toArray(),
    db.collection(COLLECTIONS.ANALYTICS).find({}).toArray(),
    db
      .collection(COLLECTIONS.AUDIT_LOGS)
      .find({
        targetType: { $in: ["homeworkSet", "question", "submission"] },
      })
      .toArray(),
    db.collection(COLLECTIONS.INSTANTIATED_QUESTIONS).find({}).toArray(),
    db.collection(COLLECTIONS.ANALYSIS_RESULTS).find({}).toArray(),
    db.collection(COLLECTIONS.STUDENT_ACTIVITIES).find({ activityType: "homework" }).toArray(),
  ]);

  const sheets: { name: string; rows: Row[] }[] = [
    { name: "homework_sets", rows: buildHomeworkSetsRows(homeworkSets) },
    {
      name: "submission_answers",
      rows: buildSubmissionAnswerRows(submissions, includeStudentTableData),
    },
    { name: "question_analytics", rows: buildQuestionAnalyticsRows(questionAnalytics) },
    { name: "analytics_events", rows: buildAnalyticsEventRows(analyticsEvents) },
    { name: "audit_logs_hw", rows: buildAuditRows(auditLogs) },
    { name: "instantiated_questions", rows: buildInstantiatedQuestionRows(instantiatedQuestions) },
    { name: "analysis_results", rows: buildAnalysisResultRows(analysisResults) },
    { name: "student_activities_homework", rows: buildStudentActivityHomeworkRows(studentActivitiesHomework) },
  ];

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");

  fs.mkdirSync(outDir, { recursive: true });

  if (format === "csv") {
    const subDir = path.join(outDir, `hw-interactions-${stamp}`);
    fs.mkdirSync(subDir, { recursive: true });
    for (const { name, rows } of sheets) {
      const filePath = path.join(subDir, `${name}.csv`);
      fs.writeFileSync(filePath, rowsToCsv(rows), "utf8");
      console.log(`Wrote ${filePath} (${rows.length} rows)`);
    }
    console.log(`\nDone. CSV folder: ${subDir}`);
    return;
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "sql-chatbot";
  workbook.created = new Date();
  for (const { name, rows } of sheets) {
    addSheetFromRows(workbook, name, rows);
    console.log(`Sheet ${name}: ${rows.length} rows`);
  }

  const xlsxPath = path.join(outDir, `hw-interactions-${stamp}.xlsx`);
  await workbook.xlsx.writeFile(xlsxPath);
  console.log(`\nDone. Excel: ${xlsxPath}`);
}

if (typeof require !== "undefined" && require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
