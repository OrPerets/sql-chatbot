import { NextRequest, NextResponse } from 'next/server';

import { getLearningNotesForUser } from '@/lib/learning-notes';

const resolveUserId = (request: NextRequest, expectedUserId: string) => {
  const headerUserId = request.headers.get('x-user-id')?.trim();

  if (!headerUserId || headerUserId !== expectedUserId) {
    return null;
  }

  return headerUserId;
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId')?.trim() ?? '';

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const authenticatedUserId = resolveUserId(request, userId);
    if (!authenticatedUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const notes = await getLearningNotesForUser(authenticatedUserId);
    const filename = `interactive-learning-notes-${authenticatedUserId}.json`;

    return new NextResponse(JSON.stringify({ notes }, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Failed to export learning notes:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export notes' },
      { status: 500 }
    );
  }
}
