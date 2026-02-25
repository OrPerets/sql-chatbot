/**
 * Export the 14 "הכנה למבחן" questions only (no answers) to a local PDF.
 * Uses the same DB as the app; run from project root.
 *
 * Usage: npx tsx scripts/export-exam-prep-questions-pdf.ts
 * Output: exam-prep-questions.pdf in project root (or path from OUT_PATH).
 */

import { getHomeworkService } from "../lib/homework";
import { getQuestionsByHomeworkSet } from "../lib/questions";
import type { Question } from "../app/homework/types";
import type { HomeworkSet } from "../app/homework/types";

const EXAM_PREP_TITLES = ["תרגיל הכנה למבחן", "הכנה למבחן"];
const OUT_PATH = process.env.OUT_PATH || "exam-prep-questions.pdf";

// Four tables from הכנה למבחן: name + columns only
const SCHEMA_TABLES: { name: string; columns: string[] }[] = [
  { name: "Exams", columns: ["ExamID", "CourseCode", "ExamDate", "DurationMinutes", "Room"] },
  { name: "Students", columns: ["StudentID", "FirstName", "LastName", "Major", "Year"] },
  {
    name: "Registrations",
    columns: ["RegistrationID", "StudentID", "ExamID", "RegisteredAt", "Status"],
  },
  { name: "Scores", columns: ["StudentID", "ExamID", "Score", "GradedAt", "FirstExamDate"] },
];

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildSchemaSectionHtml(): string {
  const tableBlocks = SCHEMA_TABLES.map(
    (t) => `
      <div class="schema-table-block">
        <div class="schema-table-name">${escapeHtml(t.name)}</div>
        <div class="schema-columns">${escapeHtml(t.columns.join(", "))}</div>
      </div>`
  );
  return `
  <div class="schema-section">
    <div class="schema-section-title">סכמת מסד הנתונים</div>
    ${tableBlocks.join("")}
  </div>`;
}

function buildQuestionsOnlyHtml(title: string, questions: Question[]): string {
  const schemaHtml = buildSchemaSectionHtml();
  const items = questions
    .map((q, i) => {
      const prompt = escapeHtml(q.prompt || "");
      const instructions = q.instructions?.trim()
        ? `<div class="instructions">${escapeHtml(q.instructions)}</div>`
        : "";
      return `
      <div class="question-block">
        <div class="question-number">שאלה ${i + 1}</div>
        <div class="question-text">${prompt}</div>
        ${instructions}
      </div>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Heebo', Arial, sans-serif;
      font-size: 12px;
      line-height: 1.5;
      color: #1f2937;
      padding: 25px;
      direction: rtl;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #e5e7eb;
    }
    .title {
      font-size: 22px;
      font-weight: 700;
      color: #1e3a5f;
    }
    .subtitle {
      font-size: 13px;
      color: #6b7280;
      margin-top: 6px;
    }
    .question-block {
      margin-bottom: 20px;
      padding: 12px 14px;
      background: #f9fafb;
      border-radius: 8px;
      border-right: 4px solid #1e3a5f;
    }
    .question-number {
      font-weight: 700;
      color: #1e3a5f;
      margin-bottom: 6px;
      font-size: 13px;
    }
    .question-text {
      font-size: 12px;
      line-height: 1.6;
      margin-bottom: 4px;
    }
    .instructions {
      font-size: 11px;
      color: #4b5563;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid #e5e7eb;
    }
    .schema-section {
      margin-bottom: 22px;
      padding: 14px;
      background: #f0f4f8;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
    }
    .schema-section-title {
      font-size: 14px;
      font-weight: 700;
      color: #1e3a5f;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid #94a3b8;
    }
    .schema-table-block {
      margin-bottom: 14px;
    }
    .schema-table-block:last-child {
      margin-bottom: 0;
    }
    .schema-table-name {
      font-weight: 600;
      color: #334155;
      font-size: 12px;
      margin-bottom: 4px;
    }
    .schema-columns {
      font-size: 11px;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${escapeHtml(title)}</div>
  </div>
  ${schemaHtml}
  <div class="questions">
    ${items}
  </div>
</body>
</html>`;
}

async function generatePdf(html: string): Promise<Buffer> {
  let puppeteer: any;
  try {
    puppeteer = require("puppeteer-core");
  } catch {
    puppeteer = require("puppeteer");
  }

  const fs = require("fs");
  const launchOptions: any = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  };

  const chromePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const p of chromePaths) {
    if (p && fs.existsSync(p)) {
      launchOptions.executablePath = p;
      break;
    }
  }

  const browser = await puppeteer.launch(launchOptions);
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "15mm", right: "10mm", bottom: "15mm", left: "10mm" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

function sortByQuestionOrder(questions: Question[], order: string[]): Question[] {
  if (!order?.length) return questions;
  const byId = new Map(questions.map((q) => [q.id, q]));
  const ordered: Question[] = [];
  for (const id of order) {
    const q = byId.get(id);
    if (q) ordered.push(q);
  }
  const remaining = questions.filter((q) => !order.includes(q.id));
  return [...ordered, ...remaining];
}

async function main() {
  const homeworkService = await getHomeworkService();
  const { items } = await homeworkService.listHomeworkSets({ pageSize: 500 });
  const examPrep = items.find((hw) =>
    EXAM_PREP_TITLES.some((t) => hw.title === t)
  ) as HomeworkSet | undefined;

  if (!examPrep) {
    console.error("No homework set 'הכנה למבחן' or 'תרגיל הכנה למבחן' found.");
    process.exit(1);
  }

  let questions = await getQuestionsByHomeworkSet(examPrep.id);
  questions = sortByQuestionOrder(questions, examPrep.questionOrder ?? []);

  if (questions.length === 0) {
    console.error("No questions found for this set.");
    process.exit(1);
  }

  console.log(`Found "${examPrep.title}" with ${questions.length} questions. Generating PDF (questions only, no answers)...`);

  const html = buildQuestionsOnlyHtml(examPrep.title, questions);
  const pdfBuffer = await generatePdf(html);

  const fs = require("fs");
  const path = require("path");
  const outPath = path.resolve(process.cwd(), OUT_PATH);
  fs.writeFileSync(outPath, pdfBuffer);
  console.log(`Written: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
