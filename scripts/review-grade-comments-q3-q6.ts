#!/usr/bin/env ts-node
/**
 * Read-only grading review for HW1.
 *
 * The workbook produced by this script is an approval artifact. It does not
 * change MongoDB. Use it to inspect proposed grades/comments for Q3-Q6 after
 * comparing the current grading style on Q2, Q7, Q8, and Q9.
 *
 * Run:
 *   npx ts-node --project tsconfig.scripts.json scripts/review-grade-comments-q3-q6.ts --homeworkSetId=69aabdaaafa3dcd3648446cc
 */

import * as fs from 'fs';
import * as path from 'path';
import { ObjectId } from 'mongodb';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';
import { connectToDatabase, COLLECTIONS } from '../lib/database';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const DEFAULT_HOMEWORK_SET_ID = '69aabdaaafa3dcd3648446cc';
const STYLE_QUESTION_NUMBERS = new Set([2, 7, 8, 9]);
const TARGET_QUESTION_NUMBERS = new Set([3, 4, 5, 6]);

interface CliOptions {
  homeworkSetId: string;
  outDir: string;
  apply: boolean;
}

interface QuestionInfo {
  id: string;
  number: number;
  prompt: string;
  points: number;
}

interface StudentInfo {
  name: string;
  studentIdNumber: string;
}

interface AnswerInfo {
  sql: string;
  score: number | null;
  comment: string;
  columns: string[];
  rowCount: number;
}

interface Proposal {
  suggestedGrade: number;
  suggestedComment: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  applyReady: boolean;
}

interface ProposalRow {
  questionNumber: number;
  questionId: string;
  studentId: string;
  studentName: string;
  studentIdNumber: string;
  currentGrade: number | null;
  currentComment: string;
  suggestedGrade: number;
  maxPoints: number;
  suggestedComment: string;
  confidence: string;
  applyReady: string;
  reason: string;
  resultRows: number;
  resultColumns: string;
  sql: string;
}

function parseArgs(): CliOptions {
  const options: CliOptions = {
    homeworkSetId: DEFAULT_HOMEWORK_SET_ID,
    outDir: path.join(process.cwd(), 'output', 'grading-review'),
    apply: false,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg === '--apply') {
      options.apply = true;
    } else if (arg.startsWith('--homeworkSetId=')) {
      options.homeworkSetId = arg.slice('--homeworkSetId='.length).trim();
    } else if (arg.startsWith('--outDir=')) {
      options.outDir = path.resolve(arg.slice('--outDir='.length).trim());
    }
  }

  return options;
}

function toObjectIdOrNull(value: string): ObjectId | null {
  return /^[0-9a-fA-F]{24}$/.test(value) ? new ObjectId(value) : null;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeSql(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function answerInfo(submission: any, questionId: string): AnswerInfo {
  const answer = submission.answers?.[questionId] ?? {};
  const feedback = answer.feedback ?? {};
  const resultPreview = answer.resultPreview ?? {};

  return {
    sql: String(answer.sql ?? ''),
    score: typeof feedback.score === 'number' ? feedback.score : null,
    comment: normalizeText(feedback.instructorNotes),
    columns: Array.isArray(resultPreview.columns) ? resultPreview.columns.map(String) : [],
    rowCount: Array.isArray(resultPreview.rows) ? resultPreview.rows.length : 0,
  };
}

function hasAny(sql: string, terms: string[]): boolean {
  return terms.some((term) => sql.includes(term));
}

function hasColumn(columns: string[], name: string): boolean {
  return columns.some((column) => column.toLowerCase() === name.toLowerCase());
}

function firstIndex(sql: string, term: string): number {
  const index = sql.indexOf(term);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

function firstNameBeforeLastName(sql: string): boolean {
  return firstIndex(sql, 'first_name') < firstIndex(sql, 'last_name');
}

function lastNameBeforeFirstName(sql: string): boolean {
  return firstIndex(sql, 'last_name') < firstIndex(sql, 'first_name');
}

function hasOrderBy(sql: string): boolean {
  return /\border\s+by\b/.test(sql);
}

function hasDescending(sql: string): boolean {
  return /\bdesc\b/.test(sql);
}

function hasAscending(sql: string): boolean {
  return /\basc\b/.test(sql);
}

function hasNewSalary(sql: string, columns: string[]): boolean {
  return /salary\s*[*+]/.test(sql) || hasColumn(columns, 'new_salary') || hasColumn(columns, 'new_salary'.toUpperCase());
}

function full(points: number, reason: string): Proposal {
  return {
    suggestedGrade: points,
    suggestedComment: '',
    confidence: 'high',
    reason,
    applyReady: true,
  };
}

function proposal(
  suggestedGrade: number,
  suggestedComment: string,
  confidence: Proposal['confidence'],
  reason: string,
  applyReady = confidence === 'high',
): Proposal {
  return { suggestedGrade, suggestedComment, confidence, reason, applyReady };
}

function gradeQ3(answer: AnswerInfo, maxPoints: number): Proposal {
  const sql = normalizeSql(answer.sql);
  const hasClerkFilter = hasAny(sql, ['clerk', 'cl01']);
  const hasIsraelFilter = sql.includes('israel');
  const hasSalaryColumn = sql.includes('salary') || hasColumn(answer.columns, 'salary');
  const hasNames = sql.includes('last_name') && sql.includes('first_name');

  if (!answer.sql.trim()) {
    return proposal(0, 'לא הוגשה שאילתה', 'high', 'empty SQL');
  }

  if (answer.rowCount === 0) {
    return proposal(5, 'השאילתה לא מחזירה את העובדים הנדרשים', 'high', 'no result rows');
  }

  if (!hasClerkFilter || !hasIsraelFilter) {
    const missing = !hasClerkFilter && !hasIsraelFilter
      ? 'נדרש לסנן גם לפי פקיד וגם לפי ישראל'
      : !hasClerkFilter
        ? 'נדרש לסנן רק לעובדים בתפקיד פקיד'
        : 'נדרש לסנן גם לעובדים בישראל';
    return proposal(8, missing, 'high', 'missing required filter');
  }

  if (!hasNames || !hasSalaryColumn || !hasNewSalary(sql, answer.columns)) {
    return proposal(8, 'חסרה עמודה נדרשת בתוצאה', 'medium', 'missing required output column');
  }

  if (firstNameBeforeLastName(sql) && !lastNameBeforeFirstName(sql)) {
    return proposal(8.5, 'נדרש להציג שם משפחה לפני שם פרטי', 'high', 'column order mismatch');
  }

  return full(maxPoints, 'matches required filters and output columns');
}

function gradeQ4(answer: AnswerInfo, maxPoints: number): Proposal {
  const sql = normalizeSql(answer.sql);

  if (!answer.sql.trim()) {
    return proposal(0, 'לא הוגשה שאילתה', 'high', 'empty SQL');
  }

  if (answer.rowCount === 0) {
    return proposal(5, 'השאילתה לא מחזירה את העובדים הנדרשים', 'high', 'no result rows');
  }

  const onlyEmployeeId =
    answer.columns.length === 1 && hasColumn(answer.columns, 'employee_id');
  const hasCityLength =
    hasAny(sql, ['length(city)', 'char_length(city)', 'len(city)'])
    || /city\s+like\s+['"]_+['"]/.test(sql);
  const hasCountryLetterFilter = sql.includes('country') && hasAny(sql, ['like', 'not like']);

  if (!onlyEmployeeId) {
    return proposal(8, 'נדרש להציג רק את תעודת הזהות של העובד', 'high', 'extra or wrong output columns');
  }

  if (!hasCityLength || !hasCountryLetterFilter) {
    return proposal(7, 'נדרש לסנן לפי אורך העיר ולפי האותיות בשם המדינה', 'medium', 'filter field mismatch');
  }

  if (!hasOrderBy(sql) || !hasDescending(sql)) {
    return proposal(8.5, 'נדרש למיין לפי תעודת זהות בסדר יורד', 'high', 'missing descending sort');
  }

  return full(maxPoints, 'matches expected output, filters, and sort');
}

function gradeQ5(answer: AnswerInfo, maxPoints: number): Proposal {
  const sql = normalizeSql(answer.sql);

  if (!answer.sql.trim()) {
    return proposal(0, 'לא הוגשה שאילתה', 'high', 'empty SQL');
  }

  if (answer.rowCount === 0) {
    return proposal(5, 'השאילתה לא מחזירה את העובדים הנדרשים', 'high', 'no result rows');
  }

  const missingColumns: string[] = [];
  if (!hasColumn(answer.columns, 'employee_id')) missingColumns.push('תעודת זהות');
  if (!hasColumn(answer.columns, 'job_id')) missingColumns.push('קוד עבודה');
  if (!hasColumn(answer.columns, 'department_name')) missingColumns.push('שם מחלקה');
  if (!hasColumn(answer.columns, 'salary')) missingColumns.push('משכורת');

  if (missingColumns.includes('שם מחלקה')) {
    return proposal(9, 'נדרש להציג את שם המחלקה ולא את קוד המחלקה', 'high', 'department_name missing');
  }

  if (missingColumns.includes('קוד עבודה')) {
    return proposal(9, 'נדרש להציג קוד עבודה ולא שם תפקיד', 'high', 'job_id missing');
  }

  if (missingColumns.includes('משכורת')) {
    return proposal(9, 'חסרה עמודת המשכורת בתוצאה', 'high', 'salary missing');
  }

  const hasSalaryFilter = /\bsalary\s*>=/.test(sql) || /\bsalary\s*>/.test(sql);
  const hasLastNameFilter = sql.includes('last_name') && sql.includes('like');
  const hasDepartmentFilter = sql.includes('department_name') && sql.includes('not like');

  if (!hasSalaryFilter || !hasLastNameFilter || !hasDepartmentFilter) {
    return proposal(8, 'חסר אחד מתנאי הסינון הנדרשים', 'medium', 'missing required filter');
  }

  if (!hasOrderBy(sql) || !sql.includes('salary') || !hasAscending(sql)) {
    return proposal(10, 'נדרש למיין לפי משכורת בסדר עולה', 'high', 'missing ascending salary sort');
  }

  if (/\bsalary\s*>[^=]/.test(sql)) {
    return proposal(11, 'נדרש לכלול גם משכורת ששווה לסף', 'medium', 'strict greater-than instead of greater-or-equal');
  }

  return full(maxPoints, 'matches expected output, filters, and sort');
}

function gradeQ6(answer: AnswerInfo, maxPoints: number): Proposal {
  const sql = normalizeSql(answer.sql);

  if (!answer.sql.trim()) {
    return proposal(0, 'לא הוגשה שאילתה', 'high', 'empty SQL');
  }

  if (answer.rowCount === 0) {
    return proposal(5, 'השאילתה לא מחזירה את העובדים הנדרשים', 'high', 'no result rows');
  }

  const hasEmployeeId = hasColumn(answer.columns, 'employee_id') || sql.includes('employee_id');
  const hasAgeOutput =
    hasColumn(answer.columns, 'age')
    || hasAny(sql, ['timestampdiff', 'datediff', 'year(', ' as age']);
  const hasAgeCalculation =
    hasAny(sql, ['timestampdiff', 'datediff', 'year('])
    || /\b20\d{2}\s*-\s*(?:\w+\.)?birth_date\b/.test(sql);
  const hasStreetFilter = sql.includes('street') && sql.includes('like');

  if (!hasEmployeeId || !hasAgeOutput) {
    return proposal(7, 'נדרש להציג תעודת זהות וגיל', 'high', 'missing employee_id or age output');
  }

  if (!hasStreetFilter) {
    return proposal(7, 'נדרש לסנן לפי הרחוב ולא לפי שדה אחר', 'medium', 'missing street filter');
  }

  if (!hasOrderBy(sql) || !hasDescending(sql) || !hasAscending(sql)) {
    return proposal(8, 'נדרש למיין לפי גיל בסדר יורד ואז לפי תאריך תחילת העסקה בסדר עולה', 'medium', 'missing required two-level sort');
  }

  if (!hasAgeCalculation) {
    return proposal(8.5, 'נדרש לחשב גיל ולא להציג רק את תאריך הלידה', 'high', 'missing age calculation');
  }

  return full(maxPoints, 'matches expected output, filter, age calculation, and sort');
}

function gradeTarget(questionNumber: number, answer: AnswerInfo, maxPoints: number): Proposal {
  if (questionNumber === 3) return gradeQ3(answer, maxPoints);
  if (questionNumber === 4) return gradeQ4(answer, maxPoints);
  if (questionNumber === 5) return gradeQ5(answer, maxPoints);
  if (questionNumber === 6) return gradeQ6(answer, maxPoints);
  throw new Error(`Unsupported target question: ${questionNumber}`);
}

function formatDistribution(values: Array<number | null>): string {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value === null ? 'missing' : String(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([grade, count]) => `${grade}: ${count}`)
    .join(', ');
}

function fitColumns<T extends object>(worksheet: XLSX.WorkSheet, rows: T[]) {
  const headers = Object.keys(rows[0] ?? {}) as Array<keyof T>;
  worksheet['!cols'] = headers.map((header) => ({
    wch: Math.min(
      80,
      Math.max(
        String(header).length + 2,
        ...rows.map((row) => normalizeText(row[header]).length + 2),
      ),
    ),
  }));
}

async function main() {
  const options = parseArgs();
  fs.mkdirSync(options.outDir, { recursive: true });

  const { client, db } = await connectToDatabase();
  const homeworkSetObjectId = toObjectIdOrNull(options.homeworkSetId);
  const homeworkSet = await db.collection(COLLECTIONS.HOMEWORK_SETS).findOne({
    $or: [
      ...(homeworkSetObjectId ? [{ _id: homeworkSetObjectId }] : []),
      { id: options.homeworkSetId },
    ],
  });

  if (!homeworkSet) {
    throw new Error(`Homework set not found: ${options.homeworkSetId}`);
  }

  const canonicalHomeworkSetId = homeworkSet._id?.toString() ?? homeworkSet.id ?? options.homeworkSetId;
  const questionIds: string[] = Array.isArray(homeworkSet.questionOrder)
    ? homeworkSet.questionOrder.map(String)
    : [];

  const [questions, submissions, users] = await Promise.all([
    db.collection(COLLECTIONS.QUESTIONS)
      .find({ homeworkSetId: canonicalHomeworkSetId })
      .toArray(),
    db.collection(COLLECTIONS.SUBMISSIONS)
      .find({ homeworkSetId: canonicalHomeworkSetId })
      .sort({ studentId: 1 })
      .toArray(),
    db.collection(COLLECTIONS.USERS).find({}).toArray(),
  ]);

  const userMap = new Map<string, StudentInfo>();
  for (const user of users) {
    const info = {
      name: user.name ?? '',
      studentIdNumber: user.studentIdNumber ?? '',
    };
    if (user.email) userMap.set(String(user.email).toLowerCase(), info);
    if (user.id) userMap.set(String(user.id).toLowerCase(), info);
    if (user._id) userMap.set(String(user._id).toLowerCase(), info);
  }

  const questionsById = new Map<string, any>();
  for (const question of questions) {
    if (question._id) questionsById.set(question._id.toString(), question);
    if (question.id) questionsById.set(String(question.id), question);
  }

  const orderedQuestions: QuestionInfo[] = questionIds
    .map((id, index) => {
      const question = questionsById.get(id);
      if (!question) return null;
      return {
        id,
        number: index + 1,
        prompt: normalizeText(question.prompt),
        points: Number(question.points ?? question.maxPoints ?? 10),
      };
    })
    .filter((question): question is QuestionInfo => Boolean(question));

  const styleRows: Record<string, unknown>[] = [];
  const styleExamples: Record<string, unknown>[] = [];

  for (const question of orderedQuestions.filter((q) => STYLE_QUESTION_NUMBERS.has(q.number))) {
    const answers = submissions.map((submission) => answerInfo(submission, question.id));
    const comments = answers.filter((answer) => answer.comment);
    const fullPointsWithComment = answers.filter(
      (answer) => answer.score === question.points && answer.comment,
    ).length;

    styleRows.push({
      question: `Q${question.number}`,
      questionId: question.id,
      maxPoints: question.points,
      submissions: answers.length,
      gradeDistribution: formatDistribution(answers.map((answer) => answer.score)),
      commentsCount: comments.length,
      fullPointsWithComment,
      observedRule: fullPointsWithComment === 0
        ? 'Full points normally has no comment; reduced grades get short Hebrew comments.'
        : 'Some full-point answers have comments; review manually.',
    });

    const grouped = new Map<string, AnswerInfo>();
    for (const answer of comments) {
      const key = `${answer.score}|${answer.comment}`;
      if (!grouped.has(key)) grouped.set(key, answer);
    }

    for (const answer of grouped.values()) {
      styleExamples.push({
        question: `Q${question.number}`,
        grade: answer.score,
        comment: answer.comment,
        resultRows: answer.rowCount,
        resultColumns: answer.columns.join(', '),
        sqlSnippet: normalizeText(answer.sql).slice(0, 400),
      });
    }
  }

  const proposalRows: ProposalRow[] = [];
  const applyReadyRows: ProposalRow[] = [];
  const proposalBySubmissionAndQuestion = new Map<string, Proposal>();

  for (const question of orderedQuestions.filter((q) => TARGET_QUESTION_NUMBERS.has(q.number))) {
    for (const submission of submissions) {
      const answer = answerInfo(submission, question.id);
      const suggestion = gradeTarget(question.number, answer, question.points);
      const submissionId = submission._id?.toString() || submission.id || submission.studentId;
      proposalBySubmissionAndQuestion.set(`${submissionId}|${question.id}`, suggestion);
      const studentInfo = userMap.get(String(submission.studentId ?? '').toLowerCase()) ?? {
        name: submission.studentName ?? '',
        studentIdNumber: submission.studentIdNumber ?? '',
      };

      const row: ProposalRow = {
        questionNumber: question.number,
        questionId: question.id,
        studentId: submission.studentId ?? '',
        studentName: studentInfo.name,
        studentIdNumber: studentInfo.studentIdNumber,
        currentGrade: answer.score,
        currentComment: answer.comment,
        suggestedGrade: suggestion.suggestedGrade,
        maxPoints: question.points,
        suggestedComment: suggestion.suggestedComment,
        confidence: suggestion.confidence,
        applyReady: suggestion.applyReady ? 'yes' : 'review',
        reason: suggestion.reason,
        resultRows: answer.rowCount,
        resultColumns: answer.columns.join(', '),
        sql: normalizeText(answer.sql),
      };

      proposalRows.push(row);
      if (suggestion.applyReady) applyReadyRows.push(row);
    }
  }

  const proposalSummary = orderedQuestions
    .filter((q) => TARGET_QUESTION_NUMBERS.has(q.number))
    .map((question) => {
      const rows = proposalRows.filter((row) => row.questionNumber === question.number);
      return {
        question: `Q${question.number}`,
        maxPoints: question.points,
        rows: rows.length,
        currentDistribution: formatDistribution(rows.map((row) => row.currentGrade)),
        suggestedDistribution: formatDistribution(rows.map((row) => row.suggestedGrade)),
        fullPointNoComment: rows.filter((row) => row.suggestedGrade === question.points && !row.suggestedComment).length,
        reducedWithComment: rows.filter((row) => row.suggestedGrade < question.points && row.suggestedComment).length,
        needsManualReview: rows.filter((row) => row.applyReady !== 'yes').length,
      };
    });

  const workbook = XLSX.utils.book_new();
  const sheets = [
    ['Style Review', styleRows],
    ['Style Examples', styleExamples],
    ['Q3-Q6 Proposals', proposalRows],
    ['Apply Ready', applyReadyRows],
    ['Proposal Summary', proposalSummary],
  ] as const;

  for (const [sheetName, rows] of sheets) {
    const typedRows = rows as object[];
    const worksheet = XLSX.utils.json_to_sheet(typedRows);
    fitColumns(worksheet, typedRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `hw1-q3-q6-grading-review-${canonicalHomeworkSetId}-${timestamp}`;
  const xlsxPath = path.join(options.outDir, `${baseName}.xlsx`);
  const jsonPath = path.join(options.outDir, `${baseName}.json`);
  const applyReportPath = path.join(options.outDir, `${baseName}.apply-report.json`);
  const backupPath = path.join(options.outDir, `${baseName}.pre-apply-backup.json`);

  XLSX.writeFile(workbook, xlsxPath);
  fs.writeFileSync(jsonPath, JSON.stringify({
    homeworkSetId: canonicalHomeworkSetId,
    homeworkTitle: homeworkSet.title ?? '',
    generatedAt: new Date().toISOString(),
    styleRows,
    proposalSummary,
    proposalRows,
  }, null, 2));

  let applySummary: Record<string, unknown> | null = null;

  if (options.apply) {
    const targetQuestions = orderedQuestions.filter((q) => TARGET_QUESTION_NUMBERS.has(q.number));
    const now = new Date().toISOString();
    const backup = submissions.map((submission) => ({
      _id: submission._id?.toString(),
      id: submission.id,
      studentId: submission.studentId,
      status: submission.status,
      overallScore: submission.overallScore,
      gradedAt: submission.gradedAt,
      updatedAt: submission.updatedAt,
      answers: targetQuestions.reduce((acc, question) => {
        acc[question.id] = submission.answers?.[question.id] ?? null;
        return acc;
      }, {} as Record<string, unknown>),
    }));
    fs.writeFileSync(backupPath, JSON.stringify({
      homeworkSetId: canonicalHomeworkSetId,
      homeworkTitle: homeworkSet.title ?? '',
      generatedAt: now,
      rows: backup,
    }, null, 2));

    const operations = submissions.map((submission) => {
      const submissionId = submission._id?.toString() || submission.id || submission.studentId;
      const updatedAnswers = { ...(submission.answers ?? {}) };

      for (const question of targetQuestions) {
        const existingAnswer = updatedAnswers[question.id] ?? { sql: '' };
        const suggestion = proposalBySubmissionAndQuestion.get(`${submissionId}|${question.id}`);
        if (!suggestion) {
          throw new Error(`Missing proposal for submission ${submissionId}, question ${question.id}`);
        }

        updatedAnswers[question.id] = {
          ...existingAnswer,
          feedback: {
            ...(existingAnswer.feedback ?? {}),
            questionId: question.id,
            score: suggestion.suggestedGrade,
            instructorNotes: suggestion.suggestedComment,
            rubricBreakdown: existingAnswer.feedback?.rubricBreakdown ?? [],
          },
        };
      }

      const overallScore = Object.values(updatedAnswers).reduce(
        (sum: number, answer: any) => sum + (typeof answer?.feedback?.score === 'number' ? answer.feedback.score : 0),
        0,
      );

      const filter = submission._id
        ? { _id: submission._id }
        : { id: submission.id };

      return {
        updateOne: {
          filter,
          update: {
            $set: {
              answers: updatedAnswers,
              overallScore,
              status: 'graded',
              gradedAt: now,
              updatedAt: now,
            },
          },
        },
      };
    });

    const result = await db.collection(COLLECTIONS.SUBMISSIONS).bulkWrite(operations, { ordered: false });

    const updatedSubmissions = await db.collection(COLLECTIONS.SUBMISSIONS)
      .find({ homeworkSetId: canonicalHomeworkSetId })
      .toArray();
    const verification = targetQuestions.map((question) => {
      const rows = updatedSubmissions.map((submission) => answerInfo(submission, question.id));
      return {
        question: `Q${question.number}`,
        gradeDistribution: formatDistribution(rows.map((row) => row.score)),
        commentsCount: rows.filter((row) => row.comment).length,
        fullPointsWithComment: rows.filter((row) => row.score === question.points && row.comment).length,
      };
    });

    applySummary = {
      mode: 'apply',
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      submissions: submissions.length,
      targetQuestions: targetQuestions.map((question) => `Q${question.number}`),
      backupPath,
      verification,
    };
    fs.writeFileSync(applyReportPath, JSON.stringify(applySummary, null, 2));
  }

  console.log('Grading review written.');
  console.log(`Homework set: ${homeworkSet.title ?? canonicalHomeworkSetId} (${canonicalHomeworkSetId})`);
  console.log(`Mode: ${options.apply ? 'apply' : 'dry-run'}`);
  console.log(`Submissions reviewed: ${submissions.length}`);
  console.log('Proposal summary:');
  console.log(JSON.stringify(proposalSummary, null, 2));
  console.log(`XLSX: ${xlsxPath}`);
  console.log(`JSON: ${jsonPath}`);
  if (applySummary) {
    console.log('Apply summary:');
    console.log(JSON.stringify(applySummary, null, 2));
    console.log(`Backup: ${backupPath}`);
    console.log(`Apply report: ${applyReportPath}`);
  }

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
