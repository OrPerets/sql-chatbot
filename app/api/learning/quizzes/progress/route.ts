import { NextRequest, NextResponse } from 'next/server';

import { LEARNING_PDFS } from '@/lib/learning-content';
import {
  getLearningQuizResultsForUser,
  getLearningQuizzesByIds,
  LearningQuizResult,
} from '@/lib/learning-quizzes';
import { requireAuthenticatedUser } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

const toDate = (value: Date | string) => (value instanceof Date ? value : new Date(value));

const countIncorrectAnswers = (result: LearningQuizResult) =>
  result.feedbackByQuestion?.filter((feedback) => !feedback.correct).length ?? 0;

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuthenticatedUser(request);
    if (authResult.ok === false) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const results = await getLearningQuizResultsForUser(authResult.userId);
    const quizIds = Array.from(new Set(results.map((result) => result.quizId)));
    const quizzes = await getLearningQuizzesByIds(quizIds);
    const quizById = new Map(quizzes.map((quiz) => [quiz.quizId, quiz]));
    const assetById = new Map(LEARNING_PDFS.map((asset) => [asset.id, asset]));

    const progressByTarget = new Map<
      string,
      {
        attemptCount: number;
        bestScore: number;
        lastScore: number;
        lastAttemptAt: Date;
        incorrectCount: number;
        questionCount: number;
      }
    >();

    results.forEach((result) => {
      const quiz = quizById.get(result.quizId);
      if (!quiz) {
        return;
      }

      const key = `${quiz.targetType}:${quiz.targetId}`;
      const current = progressByTarget.get(key);
      const completedAt = toDate(result.completedAt);
      const incorrectCount = countIncorrectAnswers(result);
      const questionCount = result.feedbackByQuestion?.length ?? 0;

      if (!current) {
        progressByTarget.set(key, {
          attemptCount: 1,
          bestScore: result.score,
          lastScore: result.score,
          lastAttemptAt: completedAt,
          incorrectCount,
          questionCount,
        });
        return;
      }

      current.attemptCount += 1;
      current.bestScore = Math.max(current.bestScore, result.score);
      current.incorrectCount += incorrectCount;
      current.questionCount += questionCount;

      if (completedAt > current.lastAttemptAt) {
        current.lastAttemptAt = completedAt;
        current.lastScore = result.score;
      }
    });

    const attemptedTargets = new Set(
      Array.from(progressByTarget.keys()).map((key) => key.split(':')[1])
    );

    const progressItems = LEARNING_PDFS.map((asset) => {
      const key = `${asset.type}:${asset.id}`;
      const progress = progressByTarget.get(key);

      return {
        targetType: asset.type,
        targetId: asset.id,
        label: asset.label,
        week: asset.week,
        attemptCount: progress?.attemptCount ?? 0,
        bestScore: progress?.bestScore ?? null,
        lastScore: progress?.lastScore ?? null,
        lastAttemptAt: progress?.lastAttemptAt
          ? progress.lastAttemptAt.toISOString()
          : null,
        accuracy:
          progress && progress.questionCount > 0
            ? Math.round(
                ((progress.questionCount - progress.incorrectCount) /
                  progress.questionCount) *
                  100
              )
            : null,
      };
    });

    const recentAttempts = results
      .slice()
      .sort((a, b) => toDate(b.completedAt).getTime() - toDate(a.completedAt).getTime())
      .slice(0, 8)
      .map((result) => {
        const quiz = quizById.get(result.quizId);
        const asset = quiz ? assetById.get(quiz.targetId) : null;
        return {
          quizId: result.quizId,
          targetType: quiz?.targetType ?? asset?.type ?? 'lecture',
          targetId: quiz?.targetId ?? asset?.id ?? '',
          label: asset?.label ?? quiz?.title ?? 'חידון',
          score: result.score,
          completedAt: toDate(result.completedAt).toISOString(),
        };
      });

    const topicsToRevisit = progressItems
      .filter((item) => item.attemptCount > 0)
      .sort((a, b) => {
        const scoreA = a.accuracy ?? a.bestScore ?? 0;
        const scoreB = b.accuracy ?? b.bestScore ?? 0;
        return scoreA - scoreB;
      })
      .slice(0, 3)
      .map((item) => item.label);

    return NextResponse.json({
      summary: {
        totalTargets: LEARNING_PDFS.length,
        attemptedTargets: attemptedTargets.size,
        completionRate: LEARNING_PDFS.length
          ? Math.round((attemptedTargets.size / LEARNING_PDFS.length) * 100)
          : 0,
        totalAttempts: results.length,
      },
      progressItems,
      recentAttempts,
      insights: {
        topicsToRevisit,
      },
    });
  } catch (error: any) {
    console.error('Failed to load quiz progress:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load quiz progress' },
      { status: 500 }
    );
  }
}
