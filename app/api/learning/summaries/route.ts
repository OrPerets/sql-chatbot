import { NextRequest, NextResponse } from 'next/server';

import {
  getLearningSummary,
  LearningSummaryMode,
} from '@/lib/learning-summaries';
import { requireAuthenticatedUser } from '@/lib/request-auth';

export const dynamic = 'force-dynamic';

const isValidSummaryMode = (value: string | null): value is LearningSummaryMode =>
  value === 'full' || value === 'highlights';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId')?.trim() ?? '';
    const pdfId = searchParams.get('pdfId')?.trim() ?? '';
    const summaryMode = searchParams.get('summaryMode');

    if (!userId || !pdfId || !isValidSummaryMode(summaryMode)) {
      return NextResponse.json(
        { error: 'userId, pdfId, and summaryMode are required' },
        { status: 400 }
      );
    }

    const authResult = await requireAuthenticatedUser(request, userId);
    if (authResult.ok === false) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const summary = await getLearningSummary(userId, pdfId, summaryMode);
    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error('Failed to load learning summary:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load summary' },
      { status: 500 }
    );
  }
}
