import { NextRequest, NextResponse } from 'next/server';

import { getLearningNotesForUser } from '@/lib/learning-notes';
import { requireAuthenticatedUser } from '@/lib/request-auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId')?.trim() ?? '';

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const authResult = await requireAuthenticatedUser(request, userId);
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const notes = await getLearningNotesForUser(userId);
    const filename = `interactive-learning-notes-${userId}.json`;

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
