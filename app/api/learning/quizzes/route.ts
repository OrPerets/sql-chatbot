import { NextRequest, NextResponse } from 'next/server';

import {
  getLatestLearningQuiz,
  LearningQuizTargetType,
} from '@/lib/learning-quizzes';
import { requireAuthenticatedUser } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

const isValidTargetType = (
  value: string | null
): value is LearningQuizTargetType => value === 'lecture' || value === 'practice';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get('targetType');
    const targetId = searchParams.get('targetId')?.trim() ?? '';

    if (!isValidTargetType(targetType) || !targetId) {
      return NextResponse.json(
        { error: 'targetType and targetId are required' },
        { status: 400 }
      );
    }

    const authResult = await requireAuthenticatedUser(request);
    if (authResult.ok === false) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const quiz = await getLatestLearningQuiz(targetType, targetId);
    return NextResponse.json({ quiz });
  } catch (error: any) {
    console.error('Failed to load learning quiz:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load quiz' },
      { status: 500 }
    );
  }
}
