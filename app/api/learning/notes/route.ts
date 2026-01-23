import { NextRequest, NextResponse } from 'next/server';

import {
  getLearningNote,
  LearningNoteTargetType,
  upsertLearningNote,
} from '@/lib/learning-notes';
import { requireAuthenticatedUser } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

type NotesQuery = {
  userId: string;
  targetType: LearningNoteTargetType;
  targetId: string;
};

const isValidTargetType = (value: string | null): value is LearningNoteTargetType =>
  value === 'pdf' || value === 'topic';

const getQuery = (request: NextRequest): NotesQuery | null => {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId')?.trim() ?? '';
  const targetType = searchParams.get('targetType');
  const targetId = searchParams.get('targetId')?.trim() ?? '';

  if (!userId || !targetId || !isValidTargetType(targetType)) {
    return null;
  }

  return {
    userId,
    targetType,
    targetId,
  };
};

export async function GET(request: NextRequest) {
  try {
    const query = getQuery(request);

    if (!query) {
      return NextResponse.json(
        { error: 'userId, targetType, and targetId are required' },
        { status: 400 }
      );
    }

    const authResult = await requireAuthenticatedUser(request, query.userId);
    if (authResult.ok === false) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const note = await getLearningNote(query.userId, query.targetType, query.targetId);
    return NextResponse.json({ note });
  } catch (error: any) {
    console.error('Failed to load learning note:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load note' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
    const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : '';
    const targetType = body.targetType as LearningNoteTargetType;
    const content = typeof body.content === 'string' ? body.content : '';

    if (!userId || !targetId || !isValidTargetType(targetType)) {
      return NextResponse.json(
        { error: 'userId, targetType, and targetId are required' },
        { status: 400 }
      );
    }

    const authResult = await requireAuthenticatedUser(request, userId);
    if (authResult.ok === false) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const note = await upsertLearningNote(userId, targetType, targetId, content);
    return NextResponse.json({ note });
  } catch (error: any) {
    console.error('Failed to save learning note:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save note' },
      { status: 500 }
    );
  }
}
