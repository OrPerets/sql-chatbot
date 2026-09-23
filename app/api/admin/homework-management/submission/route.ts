import { NextResponse } from 'next/server';

import { AdminAuthError, requireAdmin } from '@/lib/admin-auth';
import { getAdminHomeworkSubmissionPayload } from '@/lib/admin-homework-management';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const setId = searchParams.get('setId');
    const studentId = searchParams.get('studentId');

    if (!setId || !studentId) {
      return NextResponse.json({ error: 'setId and studentId are required' }, { status: 400 });
    }

    const payload = await getAdminHomeworkSubmissionPayload(setId, studentId);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.error('Error loading admin homework submission:', error);
    return NextResponse.json({ error: 'Failed to load submission' }, { status: 500 });
  }
}
