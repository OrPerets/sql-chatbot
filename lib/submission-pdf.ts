import type { HomeworkSet, Question, Submission } from "@/app/homework/types";

// Use puppeteer-core for serverless environments, puppeteer for local development
let puppeteer: any;
try {
  // Try puppeteer-core first (works in serverless)
  puppeteer = require("puppeteer-core");
} catch {
  // Fallback to puppeteer (works in local development)
  puppeteer = require("puppeteer");
}

// Use @sparticuz/chromium for serverless environments (Vercel, AWS Lambda, etc.)
let chromium: any = null;
if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  try {
    chromium = require("@sparticuz/chromium");
  } catch (error) {
    console.warn("⚠️ @sparticuz/chromium not available, falling back to default puppeteer");
  }
}

interface PdfOptions {
  submission: Submission;
  questions: Question[];
  homework: HomeworkSet;
  studentName?: string;
  studentEmail?: string;
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

function generateHtmlWithFeedback(options: PdfOptions): string {
  const { submission, questions, studentName, studentEmail } = options;

  // Build title with name and email
  let displayTitle = "סטודנט";
  if (studentName && studentEmail) {
    displayTitle = `${studentName} / ${studentEmail}`;
  } else if (studentName) {
    displayTitle = studentName;
  } else if (studentEmail) {
    displayTitle = studentEmail;
  } else if (submission.studentId) {
    displayTitle = submission.studentId;
  }

  const submissionDate = submission.submittedAt
    ? formatDate(new Date(submission.submittedAt))
    : formatDate(new Date());

  // Calculate total grade
  let totalScore = 0;
  let totalMaxPoints = 0;
  questions.forEach((question) => {
    const answer = submission.answers?.[question.id];
    const feedback = answer?.feedback;
    const score = typeof feedback?.score === "number" ? feedback.score : 0;
    const maxPoints = typeof question.points === "number" ? question.points : 0;
    totalScore += score;
    totalMaxPoints += maxPoints;
  });
  const totalGradeText = totalMaxPoints > 0 ? `${totalScore}/${totalMaxPoints}` : `${totalScore}`;

  const tableRows = questions
    .map((question) => {
      const answer = submission.answers?.[question.id];
      const answerText = answer?.sql?.trim() || "";
      const feedback = answer?.feedback;
      const score = typeof feedback?.score === "number" ? feedback.score : null;
      const maxPoints = typeof question.points === "number" ? question.points : null;
      const scoreText =
        score !== null && maxPoints !== null ? `${score}/${maxPoints}` : score !== null ? `${score}` : "-";
      const instructorNotes = feedback?.instructorNotes?.trim();
      const notesHtml = instructorNotes
        ? `<div class="notes"><strong>הערות:</strong> ${escapeHtml(instructorNotes)}</div>`
        : "";

      return `
      <tr>
        <td class="question-cell">
          <div class="question-text">${escapeHtml(question.prompt)}</div>
          ${question.instructions ? `<div class="instructions">${escapeHtml(question.instructions)}</div>` : ""}
        </td>
        <td class="answer-cell">
          ${answerText ? `<pre class="sql-code">${escapeHtml(answerText)}</pre>` : '<span class="no-answer">-</span>'}
        </td>
        <td class="feedback-cell">
          <div class="score-line">ציון: ${escapeHtml(scoreText)}</div>
          ${notesHtml || '<span class="no-feedback">-</span>'}
        </td>
      </tr>
    `;
    })
    .join("");

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
      font-size: 10px;
      line-height: 1.4;
      color: #1f2937;
      padding: 15px;
      direction: rtl;
    }
    
    .header {
      text-align: center;
      margin-bottom: 15px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .title {
      font-size: 20px;
      font-weight: 700;
      color: #1e3a5f;
      margin-bottom: 6px;
    }
    
    .date {
      font-size: 11px;
      color: #6b7280;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    
    th {
      background-color: #1e3a5f;
      color: white;
      font-weight: 600;
      padding: 8px 10px;
      text-align: right;
      font-size: 11px;
    }

    th:first-child {
      width: 25%;
      border-radius: 0 8px 0 0;
    }

    th:nth-child(2) {
      width: 35%;
    }
    
    th:last-child {
      width: 40%;
      border-radius: 8px 0 0 0;
    }
    
    td {
      padding: 8px 10px;
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
      font-size: 9px;
      color: #374151;
      margin-bottom: 4px;
      line-height: 1.3;
    }
    
    .instructions {
      font-size: 8px;
      color: #6b7280;
      padding-top: 4px;
      border-top: 1px dashed #d1d5db;
      line-height: 1.3;
    }
    
    .answer-cell {
      text-align: left;
      direction: ltr;
    }
    
    .sql-code {
      font-family: 'Courier New', monospace;
      font-size: 9px;
      background-color: #f1f5f9;
      padding: 6px 8px;
      border-radius: 4px;
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
      color: #1e293b;
      line-height: 1.3;
    }
    
    .no-answer {
      color: #9ca3af;
      font-style: italic;
    }

    .feedback-cell {
      text-align: right;
      direction: rtl;
    }

    .score-line {
      font-weight: 600;
      color: #1e3a5f;
      margin-bottom: 4px;
      font-size: 10px;
    }

    .notes {
      font-size: 9px;
      color: #374151;
      margin-bottom: 4px;
      line-height: 1.3;
    }

    .no-feedback {
      color: #9ca3af;
      font-style: italic;
    }

    .total-grade {
      font-size: 14px;
      font-weight: 700;
      color: #1e3a5f;
      margin-bottom: 8px;
      padding: 6px;
      background-color: #f0f4f8;
      border-radius: 4px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${escapeHtml(displayTitle)}</div>
    <div class="total-grade">ציון סופי: ${escapeHtml(totalGradeText)}</div>
    <div class="date">${submissionDate}</div>
  </div>
  
  <table>
    <thead>
      <tr>
        <th>שאלה</th>
        <th>תשובה</th>
        <th>משוב וציון</th>
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
  
  // Configure browser launch options based on environment
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
  const launchOptions: any = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
    ],
  };
  
  // Use @sparticuz/chromium for serverless environments
  if (isServerless && chromium) {
    try {
      // Configure chromium for serverless (Vercel/AWS Lambda)
      chromium.setGraphicsMode = false;
      launchOptions.executablePath = await chromium.executablePath();
      launchOptions.args = chromium.args;
    } catch (error: any) {
      console.error("⚠️ Failed to configure chromium for serverless:", error.message);
      throw new Error(`PDF generation not available in serverless environment: ${error.message}`);
    }
  } else if (!isServerless) {
    // For local development, try to find Chrome/Chromium executable
    // Check if puppeteer-core is being used (which doesn't include browser)
    const fs = require('fs');
    const path = require('path');
    
    // Common Chrome/Chromium paths
    const chromePaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
      '/usr/bin/google-chrome', // Linux
      '/usr/bin/chromium', // Linux
      '/usr/bin/chromium-browser', // Linux
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', // Windows
    ];
    
    // Find first existing Chrome executable
    for (const chromePath of chromePaths) {
      if (chromePath && fs.existsSync(chromePath)) {
        launchOptions.executablePath = chromePath;
        break;
      }
    }
    
    // If no Chrome found and using puppeteer-core, try to use regular puppeteer
    if (!launchOptions.executablePath && puppeteer.name === 'puppeteer-core') {
      try {
        const puppeteerFull = require('puppeteer');
        const browser = await puppeteerFull.launch(launchOptions);
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
      } catch (error: any) {
        throw new Error(`PDF generation failed: ${error.message}. Please install Chrome or set PUPPETEER_EXECUTABLE_PATH environment variable.`);
      }
    }
  }
  
  const browser = await puppeteer.launch(launchOptions);
  
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

export async function generateSubmissionPdfWithFeedback({
  submission,
  questions,
  homework,
  studentName,
  studentEmail,
}: PdfOptions): Promise<Buffer> {
  const html = generateHtmlWithFeedback({ submission, questions, homework, studentName, studentEmail });

  // Configure browser launch options based on environment
  const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
  const launchOptions: any = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--single-process",
    ],
  };

  // Use @sparticuz/chromium for serverless environments
  if (isServerless && chromium) {
    try {
      // Configure chromium for serverless (Vercel/AWS Lambda)
      chromium.setGraphicsMode = false;
      launchOptions.executablePath = await chromium.executablePath();
      launchOptions.args = chromium.args;
    } catch (error: any) {
      console.error("⚠️ Failed to configure chromium for serverless:", error.message);
      throw new Error(`PDF generation not available in serverless environment: ${error.message}`);
    }
  } else if (!isServerless) {
    // For local development, try to find Chrome/Chromium executable
    // Check if puppeteer-core is being used (which doesn't include browser)
    const fs = require("fs");
    const path = require("path");

    // Common Chrome/Chromium paths
    const chromePaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", // macOS
      "/usr/bin/google-chrome", // Linux
      "/usr/bin/chromium", // Linux
      "/usr/bin/chromium-browser", // Linux
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", // Windows
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", // Windows
    ];

    // Find first existing Chrome executable
    for (const chromePath of chromePaths) {
      if (chromePath && fs.existsSync(chromePath)) {
        launchOptions.executablePath = chromePath;
        break;
      }
    }

    // If no Chrome found and using puppeteer-core, try to use regular puppeteer
    if (!launchOptions.executablePath && puppeteer.name === "puppeteer-core") {
      try {
        const puppeteerFull = require("puppeteer");
        const browser = await puppeteerFull.launch(launchOptions);
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
      } catch (error: any) {
        throw new Error(
          `PDF generation failed: ${error.message}. Please install Chrome or set PUPPETEER_EXECUTABLE_PATH environment variable.`,
        );
      }
    }
  }

  const browser = await puppeteer.launch(launchOptions);

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
