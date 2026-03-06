import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { connectToDatabase, COLLECTIONS } from '@/lib/database';
import type { QuestionAnalyticsModel } from '@/lib/models';
import type { SubmissionModel } from '@/lib/models';

const DEFAULT_SET_ID = '697b602f8d8cd886902367b1';

export interface ExamPrepStudentRow {
  studentId: string;
  studentName?: string;
  studentIdNumber?: string;
  submissionId: string;
  status: string;
  overallScore: number;
  submittedAt?: string;
  gradedAt?: string;
  attemptNumber: number;
  answeredCount: number;
  totalQuestions: number;
  progressPercent: number;
  aiCommitmentSigned?: boolean;
  aiCommitmentDeclaredNoAi?: boolean;
  /** Aggregated from question_analytics */
  analytics: {
    questionCount: number;
    totalTimeSpentMs: number;
    avgTypingSpeed: number;
    totalAttempts: number;
    totalCharactersTyped: number;
    totalEditsCount: number;
    totalCopyPasteCount: number;
    totalShowAnswerClicks: number;
    avgTimeToFirstShowAnswer: number | null;
    totalExecutions: number;
    avgTimeToFirstExecution: number | null;
    hintsUsedTotal: number;
    confidenceAvg: number | null;
    aiAssistanceUsedCount: number;
    /** Per-question summary */
    byQuestion: Array<{
      questionId: string;
      timeSpent: number;
      attempts: number;
      showAnswerClicks: number;
      timeToFirstShowAnswer: number | null;
      charactersTyped: number;
      editsCount: number;
      copyPasteCount: number;
      summary?: string;
    }>;
  };
}

function buildSetIdQuery(setId: string) {
  const isValidObjectId = ObjectId.isValid(setId);
  return isValidObjectId
    ? {
        $or: [
          { homeworkSetId: new ObjectId(setId).toString() },
          { homeworkSetId: setId },
        ],
      }
    : { homeworkSetId: setId };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const setId = searchParams.get('setId') || DEFAULT_SET_ID;

    const { db } = await connectToDatabase();
    const submissionsCol = db.collection<SubmissionModel>(COLLECTIONS.SUBMISSIONS);
    const qaCol = db.collection<QuestionAnalyticsModel>(COLLECTIONS.QUESTION_ANALYTICS);
    const usersCol = db.collection(COLLECTIONS.USERS);
    const questionsCol = db.collection(COLLECTIONS.QUESTIONS);

    const setQuery = buildSetIdQuery(setId);

    const [submissions, allAnalytics, questionCount] = await Promise.all([
      submissionsCol.find(setQuery).toArray(),
      qaCol.find(setQuery).toArray(),
      questionsCol.countDocuments(setQuery),
    ]);

    const studentIds = [...new Set(submissions.map((s) => s.studentId))];
    const users = await usersCol
      .find({
        $or: [
          { email: { $in: studentIds } },
          { id: { $in: studentIds } },
        ],
      })
      .toArray();

    const userMap = new Map<string, { name?: string; studentIdNumber?: string }>();
    users.forEach((u: { email?: string; id?: string; name?: string; firstName?: string; lastName?: string; studentIdNumber?: string }) => {
      const key = u.email || u.id || '';
      userMap.set(key, {
        name: u.name || (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : undefined),
        studentIdNumber: u.studentIdNumber,
      });
    });

    const analyticsBySubmission = new Map<string, QuestionAnalyticsModel[]>();
    allAnalytics.forEach((a) => {
      const list = analyticsBySubmission.get(a.submissionId) || [];
      list.push(a);
      analyticsBySubmission.set(a.submissionId, list);
    });

    const rows: ExamPrepStudentRow[] = submissions.map((sub) => {
      const submissionId = sub._id?.toString() || (sub as { id?: string }).id || '';
      const qaList = analyticsBySubmission.get(submissionId) || [];
      const answers = sub.answers || {};
      const answeredCount = Object.values(answers).filter(
        (a) => Boolean(a?.sql?.trim()) || Boolean((a as { feedback?: { score?: number } })?.feedback?.score)
      ).length;
      const totalQuestions = Math.max(questionCount, 1);
      const progressPercent = Math.round((answeredCount / totalQuestions) * 100);

      const totalTimeSpentMs = qaList.reduce((s, a) => s + (a.metrics?.timeSpent ?? 0), 0);
      const typingSpeeds = qaList.map((a) => a.metrics?.typingSpeed ?? 0).filter((v) => v > 0);
      const totalAttempts = qaList.reduce((s, a) => s + (a.metrics?.attempts ?? 0), 0);
      const totalChars = qaList.reduce((s, a) => s + (a.metrics?.charactersTyped ?? 0), 0);
      const totalEdits = qaList.reduce((s, a) => s + (a.metrics?.editsCount ?? 0), 0);
      const totalCopyPaste = qaList.reduce((s, a) => s + (a.metrics?.copyPasteCount ?? 0), 0);
      const totalShowClicks = qaList.reduce((s, a) => s + (a.metrics?.showAnswerClicks ?? 0), 0);
      const firstShowTimes = qaList
        .map((a) => a.metrics?.timeToFirstShowAnswer)
        .filter((v): v is number => typeof v === 'number' && v > 0);
      const avgTimeToFirstShow =
        firstShowTimes.length > 0
          ? Math.round(firstShowTimes.reduce((a, b) => a + b, 0) / firstShowTimes.length)
          : null;
      const execTimes = qaList.flatMap((a) => a.metrics?.queryExecutionTimes ?? []);
      const totalExecutions = execTimes.length;
      const firstExecTimes = qaList
        .map((a) => a.metrics?.timeToFirstExecution)
        .filter((v): v is number => typeof v === 'number' && v > 0);
      const avgTimeToFirstExec =
        firstExecTimes.length > 0
          ? Math.round(firstExecTimes.reduce((a, b) => a + b, 0) / firstExecTimes.length)
          : null;
      const hintsTotal = qaList.reduce(
        (s, a) => s + (a.metrics?.generalAnalysis?.hintsUsed ?? 0),
        0
      );
      const confidences = qaList
        .map((a) => a.metrics?.generalAnalysis?.confidence)
        .filter((v): v is number => typeof v === 'number');
      const confidenceAvg =
        confidences.length > 0
          ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 10) / 10
          : null;
      const aiAssistanceCount = qaList.filter(
        (a) => a.metrics?.generalAnalysis?.aiAssistanceUsed === true
      ).length;

      const byQuestion = qaList.map((a) => ({
        questionId: a.questionId,
        timeSpent: a.metrics?.timeSpent ?? 0,
        attempts: a.metrics?.attempts ?? 0,
        showAnswerClicks: a.metrics?.showAnswerClicks ?? 0,
        timeToFirstShowAnswer: a.metrics?.timeToFirstShowAnswer ?? null,
        charactersTyped: a.metrics?.charactersTyped ?? 0,
        editsCount: a.metrics?.editsCount ?? 0,
        copyPasteCount: a.metrics?.copyPasteCount ?? 0,
        summary: a.metrics?.generalAnalysis?.summary,
      }));

      const userData = userMap.get(sub.studentId);

      return {
        studentId: sub.studentId,
        studentName: userData?.name,
        studentIdNumber: userData?.studentIdNumber,
        submissionId,
        status: sub.status,
        overallScore: sub.overallScore ?? 0,
        submittedAt: sub.submittedAt,
        gradedAt: sub.gradedAt,
        attemptNumber: sub.attemptNumber ?? 1,
        answeredCount,
        totalQuestions: questionCount,
        progressPercent,
        aiCommitmentSigned: (sub as { aiCommitment?: { signed?: boolean } }).aiCommitment?.signed,
        aiCommitmentDeclaredNoAi: (sub as { aiCommitment?: { declaredNoAi?: boolean } }).aiCommitment?.declaredNoAi,
        analytics: {
          questionCount: qaList.length,
          totalTimeSpentMs,
          avgTypingSpeed:
            typingSpeeds.length > 0
              ? Math.round((typingSpeeds.reduce((a, b) => a + b, 0) / typingSpeeds.length) * 10) / 10
              : 0,
          totalAttempts,
          totalCharactersTyped: totalChars,
          totalEditsCount: totalEdits,
          totalCopyPasteCount: totalCopyPaste,
          totalShowAnswerClicks: totalShowClicks,
          avgTimeToFirstShowAnswer: avgTimeToFirstShow,
          totalExecutions: totalExecutions,
          avgTimeToFirstExecution: avgTimeToFirstExec,
          hintsUsedTotal: hintsTotal,
          confidenceAvg,
          aiAssistanceUsedCount: aiAssistanceCount,
          byQuestion,
        },
      } satisfies ExamPrepStudentRow;
    });

    return NextResponse.json({
      success: true,
      data: {
        homeworkSetId: setId,
        questionCount,
        students: rows,
      },
    });
  } catch (error) {
    console.error('[exam-prep-analytics]', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
