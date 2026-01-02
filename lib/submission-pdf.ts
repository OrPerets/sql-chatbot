import puppeteer from "puppeteer";
import type { HomeworkSet, Question, Submission } from "@/app/homework/types";

interface PdfOptions {
  submission: Submission;
  questions: Question[];
  homework: HomeworkSet;
  studentName?: string;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Format date in Hebrew format
 */
function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Generate HTML for the submission
 */
function generateHtml(options: PdfOptions): string {
  const { submission, questions, studentName } = options;
  
  const displayName = studentName || submission.studentId || "סטודנט";
  const submissionDate = submission.submittedAt 
    ? formatDate(new Date(submission.submittedAt))
    : formatDate(new Date());

  const tableRows = questions.map((question) => {
    const answer = submission.answers?.[question.id];
    const answerText = answer?.sql?.trim() || "";
    
    return `
      <tr>
        <td class="question-cell">
          <div class="question-text">${escapeHtml(question.prompt)}</div>
          ${question.instructions ? `<div class="instructions">${escapeHtml(question.instructions)}</div>` : ""}
        </td>
        <td class="answer-cell">
          ${answerText ? `<pre class="sql-code">${escapeHtml(answerText)}</pre>` : '<span class="no-answer">-</span>'}
        </td>
      </tr>
    `;
  }).join("");

  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
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
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .title {
      font-size: 24px;
      font-weight: 700;
      color: #1e3a5f;
      margin-bottom: 8px;
    }
    
    .date {
      font-size: 14px;
      color: #6b7280;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 20px;
    }
    
    th {
      background-color: #1e3a5f;
      color: white;
      font-weight: 600;
      padding: 12px 16px;
      text-align: right;
      font-size: 14px;
    }
    
    th:first-child {
      width: 60%;
      border-radius: 0 8px 0 0;
    }
    
    th:last-child {
      width: 40%;
      border-radius: 8px 0 0 0;
    }
    
    td {
      padding: 12px 14px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }
    
    tr:nth-child(even) {
      background-color: #f9fafb;
    }
    
    tr:last-child td:first-child {
      border-radius: 0 0 8px 0;
    }
    
    tr:last-child td:last-child {
      border-radius: 0 0 0 8px;
    }
    
    .question-cell {
      text-align: right;
    }
    
    .question-text {
      font-size: 11px;
      color: #374151;
      margin-bottom: 6px;
    }
    
    .instructions {
      font-size: 10px;
      color: #6b7280;
      padding-top: 6px;
      border-top: 1px dashed #d1d5db;
    }
    
    .answer-cell {
      text-align: left;
      direction: ltr;
    }
    
    .sql-code {
      font-family: 'Courier New', monospace;
      font-size: 11px;
      background-color: #f1f5f9;
      padding: 10px 12px;
      border-radius: 6px;
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
      color: #1e293b;
    }
    
    .no-answer {
      color: #9ca3af;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${escapeHtml(displayName)}</div>
    <div class="date">${submissionDate}</div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>שאלה</th>
        <th>תשובה</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
</body>
</html>
  `;
}

export async function generateSubmissionPdf({
  submission,
  questions,
  homework,
  studentName,
}: PdfOptions): Promise<Buffer> {
  const html = generateHtml({ submission, questions, homework, studentName });
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "15mm",
        right: "10mm",
        bottom: "15mm",
        left: "10mm",
      },
    });
    
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
