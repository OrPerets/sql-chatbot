#!/usr/bin/env ts-node
/**
 * Recover instructor-note evidence from comment_bank entries.
 *
 * This script is intentionally conservative. It writes a JSON/CSV report for
 * every saved comment-bank entry and only applies a note back to submissions
 * when there is exactly one empty-note answer with the same homeworkSetId,
 * questionId, and score.
 *
 * Run:
 *   npx ts-node --project tsconfig.scripts.json scripts/recover-comment-bank-notes.ts --homeworkSetId=69aabdaaafa3dcd3648446cc
 *   npx ts-node --project tsconfig.scripts.json scripts/recover-comment-bank-notes.ts --homeworkSetId=69aabdaaafa3dcd3648446cc --apply
 */

import * as fs from 'fs';
import * as path from 'path';
import { ObjectId } from 'mongodb';
import { connectToDatabase, COLLECTIONS } from '../lib/database';

const COMMENT_BANK_COLLECTION = 'comment_bank';
const DEFAULT_HOMEWORK_SET_ID = '69aabdaaafa3dcd3648446cc';

interface CliOptions {
  homeworkSetId: string;
  apply: boolean;
  outDir: string;
}

interface CandidateRow {
  submissionId: string;
  studentId: string;
  status: string;
  overallScore: number | null;
  answerScore: number | null;
  updatedAt: string;
  gradedAt: string;
  currentNotes: string;
  sqlSnippet: string;
}

interface CommentRecoveryRow {
  commentId: string;
  homeworkSetId: string;
  questionId: string;
  questionLabel: string;
  score: number;
  maxScore: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  exactExisting: CandidateRow[];
  partialExisting: CandidateRow[];
  emptyScoreMatches: CandidateRow[];
  status:
    | 'already_exact'
    | 'unique_recoverable'
    | 'ambiguous'
    | 'partial_existing'
    | 'no_safe_match';
  applied: boolean;
}

function parseArgs(): CliOptions {
  const options: CliOptions = {
    homeworkSetId: DEFAULT_HOMEWORK_SET_ID,
    apply: false,
    outDir: path.join(process.cwd(), 'output', 'comment-recovery'),
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

function normalizeText(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function toObjectIdOrNull(value: string): ObjectId | null {
  return /^[0-9a-fA-F]{24}$/.test(value) ? new ObjectId(value) : null;
}

function submissionIdOf(submission: any): string {
  return submission._id?.toString() || submission.id || '';
}

function toCandidateRow(submission: any, questionId: string): CandidateRow {
  const answer = submission.answers?.[questionId] ?? {};
  const feedback = answer.feedback ?? {};

  return {
    submissionId: submissionIdOf(submission),
    studentId: submission.studentId ?? '',
    status: submission.status ?? '',
    overallScore: typeof submission.overallScore === 'number' ? submission.overallScore : null,
    answerScore: typeof feedback.score === 'number' ? feedback.score : null,
    updatedAt: submission.updatedAt ?? '',
    gradedAt: submission.gradedAt ?? '',
    currentNotes: feedback.instructorNotes ?? '',
    sqlSnippet: normalizeText(answer.sql).slice(0, 220),
  };
}

function classify(row: Omit<CommentRecoveryRow, 'status' | 'applied'>): CommentRecoveryRow['status'] {
  if (row.exactExisting.length > 0) return 'already_exact';
  if (row.emptyScoreMatches.length === 1) return 'unique_recoverable';
  if (row.emptyScoreMatches.length > 1) return 'ambiguous';
  if (row.partialExisting.length > 0) return 'partial_existing';
  return 'no_safe_match';
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
  const canonicalHomeworkSetId = homeworkSet?._id?.toString() ?? options.homeworkSetId;

  const [comments, questions, submissions] = await Promise.all([
    db.collection(COMMENT_BANK_COLLECTION)
      .find({ homeworkSetId: canonicalHomeworkSetId })
      .sort({ createdAt: 1 })
      .toArray(),
    db.collection(COLLECTIONS.QUESTIONS)
      .find({ homeworkSetId: canonicalHomeworkSetId })
      .project({ prompt: 1, id: 1 })
      .toArray(),
    db.collection(COLLECTIONS.SUBMISSIONS)
      .find({ homeworkSetId: canonicalHomeworkSetId })
      .toArray(),
  ]);

  const questionsById = new Map<string, string>();
  for (const question of questions) {
    const label = normalizeText(question.prompt || question.id || question._id?.toString());
    if (question._id) questionsById.set(question._id.toString(), label);
    if (question.id) questionsById.set(question.id, label);
  }

  const rows: CommentRecoveryRow[] = [];
  for (const comment of comments) {
    const commentText = normalizeText(comment.comment);
    const exactExisting: CandidateRow[] = [];
    const partialExisting: CandidateRow[] = [];
    const emptyScoreMatches: CandidateRow[] = [];

    for (const submission of submissions) {
      const answer = submission.answers?.[comment.questionId];
      if (!answer) continue;

      const answerScore = answer.feedback?.score;
      const noteText = normalizeText(answer.feedback?.instructorNotes);
      const candidate = toCandidateRow(submission, comment.questionId);

      if (noteText && noteText === commentText) {
        exactExisting.push(candidate);
        continue;
      }

      if (
        noteText
        && (noteText.includes(commentText) || commentText.includes(noteText))
      ) {
        partialExisting.push(candidate);
      }

      if (!noteText && Number(answerScore) === Number(comment.score)) {
        emptyScoreMatches.push(candidate);
      }
    }

    const baseRow = {
      commentId: comment._id?.toString() || comment.id,
      homeworkSetId: canonicalHomeworkSetId,
      questionId: comment.questionId,
      questionLabel: questionsById.get(comment.questionId) ?? comment.questionId,
      score: comment.score,
      maxScore: comment.maxScore,
      comment: comment.comment,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      usageCount: comment.usageCount ?? 0,
      exactExisting,
      partialExisting,
      emptyScoreMatches,
    };

    const row: CommentRecoveryRow = {
      ...baseRow,
      status: classify(baseRow),
      applied: false,
    };

    if (options.apply && row.status === 'unique_recoverable') {
      const target = row.emptyScoreMatches[0];
      const targetObjectId = toObjectIdOrNull(target.submissionId);
      const result = await db.collection(COLLECTIONS.SUBMISSIONS).updateOne(
        {
          $or: [
            ...(targetObjectId ? [{ _id: targetObjectId }] : []),
            { id: target.submissionId },
          ],
          [`answers.${row.questionId}.feedback.instructorNotes`]: { $in: [null, ''] },
        },
        {
          $set: {
            [`answers.${row.questionId}.feedback.instructorNotes`]: row.comment,
            updatedAt: new Date().toISOString(),
          },
        },
      );
      row.applied = result.modifiedCount === 1;
    }

    rows.push(row);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(options.outDir, `comment-recovery-${canonicalHomeworkSetId}-${timestamp}.json`);
  const csvPath = path.join(options.outDir, `comment-recovery-${canonicalHomeworkSetId}-${timestamp}.csv`);

  fs.writeFileSync(jsonPath, JSON.stringify({
    homeworkSetId: canonicalHomeworkSetId,
    homeworkTitle: homeworkSet?.title ?? '',
    generatedAt: new Date().toISOString(),
    apply: options.apply,
    summary: {
      comments: rows.length,
      alreadyExact: rows.filter((row) => row.status === 'already_exact').length,
      uniqueRecoverable: rows.filter((row) => row.status === 'unique_recoverable').length,
      ambiguous: rows.filter((row) => row.status === 'ambiguous').length,
      partialExisting: rows.filter((row) => row.status === 'partial_existing').length,
      noSafeMatch: rows.filter((row) => row.status === 'no_safe_match').length,
      applied: rows.filter((row) => row.applied).length,
    },
    rows,
  }, null, 2));

  const csvRows = [
    [
      'status',
      'applied',
      'commentId',
      'questionId',
      'questionLabel',
      'score',
      'maxScore',
      'usageCount',
      'createdAt',
      'comment',
      'exactExistingStudents',
      'partialExistingStudents',
      'emptyScoreMatchStudents',
    ],
    ...rows.map((row) => [
      row.status,
      row.applied ? 'yes' : 'no',
      row.commentId,
      row.questionId,
      row.questionLabel,
      row.score,
      row.maxScore,
      row.usageCount,
      row.createdAt,
      row.comment,
      row.exactExisting.map((candidate) => candidate.studentId).join('; '),
      row.partialExisting.map((candidate) => candidate.studentId).join('; '),
      row.emptyScoreMatches.map((candidate) => candidate.studentId).join('; '),
    ].map(csvCell).join(',')),
  ].map((row) => Array.isArray(row) ? row.map(csvCell).join(',') : row).join('\n');

  fs.writeFileSync(csvPath, csvRows);

  const summary = rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    if (row.applied) acc.applied = (acc.applied ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('Comment recovery report written.');
  console.log(`Homework set: ${homeworkSet?.title ?? canonicalHomeworkSetId} (${canonicalHomeworkSetId})`);
  console.log(`Mode: ${options.apply ? 'apply' : 'dry-run'}`);
  console.log(JSON.stringify(summary, null, 2));
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV: ${csvPath}`);

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
