import { randomUUID } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';

import {
  compareSql,
  createLearningQuizResult,
  getLearningQuizById,
  LearningQuizAnswer,
  LearningQuizFeedback,
} from '@/lib/learning-quizzes';
import { requireAuthenticatedUser } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

type QuizAttemptPayload = {
  userId: string;
  quizId: string;
  answers: Array<{
    questionId: string;
    response: string | number | null;
  }>;
  startedAt?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as QuizAttemptPayload;
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const quizId = typeof body.quizId === 'string' ? body.quizId.trim() : '';
    const answersPayload = Array.isArray(body.answers) ? body.answers : [];

    if (!userId || !quizId) {
      return NextResponse.json(
        { error: 'userId and quizId are required' },
        { status: 400 }
      );
    }

    const authResult = await requireAuthenticatedUser(request, userId);
    if (authResult.ok === false) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const quiz = await getLearningQuizById(quizId);
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const answers: LearningQuizAnswer[] = [];
    const feedbackByQuestion: LearningQuizFeedback[] = [];

    let correctCount = 0;

    quiz.questions.forEach((question) => {
      const answer = answersPayload.find((item) => item.questionId === question.id);
      let correct = false;
      let message = 'לא נענתה תשובה.';

      if (question.type === 'mcq') {
        const responseIndex =
          typeof answer?.response === 'number'
            ? answer.response
            : Number.isNaN(Number(answer?.response))
              ? null
              : Number(answer?.response);

        if (responseIndex !== null) {
          correct = responseIndex === question.correctIndex;
          message = correct ? 'תשובה נכונה!' : 'התשובה אינה נכונה.';
        } else {
          message = 'בחרו תשובה כדי לקבל משוב.';
        }
      }

      if (question.type === 'sql') {
        const responseSql = typeof answer?.response === 'string' ? answer.response.trim() : '';
        if (!responseSql) {
          message = 'הזינו שאילתה כדי לבדוק אותה.';
        } else if (question.expectedSql) {
          correct = compareSql(responseSql, question.expectedSql);
          message = correct ? 'השאילתה נראית נכונה!' : 'השאילתה לא תואמת לתשובה הצפויה.';
        } else {
          message = 'אין עדיין בדיקה אוטומטית לשאלה הזו.';
        }
      }

      if (correct) {
        correctCount += 1;
      }

      answers.push({
        questionId: question.id,
        response:
          typeof answer?.response === 'number' || typeof answer?.response === 'string'
            ? answer.response
            : null,
        correct,
      });

      feedbackByQuestion.push({
        questionId: question.id,
        correct,
        message,
        explanation: question.explanation,
      });
    });

    const totalQuestions = quiz.questions.length || 1;
    const score = Math.round((correctCount / totalQuestions) * 100);
    const startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
    const completedAt = new Date();

    const attempt = await createLearningQuizResult({
      userId,
      quizId,
      attemptId: randomUUID(),
      startedAt,
      completedAt,
      score,
      answers,
      feedbackByQuestion,
    });

    return NextResponse.json({ attempt });
  } catch (error: any) {
    console.error('Failed to save quiz attempt:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save quiz attempt' },
      { status: 500 }
    );
  }
}
