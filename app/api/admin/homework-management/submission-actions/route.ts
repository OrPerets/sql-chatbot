import { NextResponse } from 'next/server';

import { AdminAuthError, requireAdmin } from '@/lib/admin-auth';
import { reopenHomeworkSubmission } from '@/lib/admin-homework-management';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { email } = await requireAdmin(request);
    const body = await request.json();
    const action = String(body.action || '');
    const homeworkSetId = String(body.homeworkSetId || '');
    const studentId = String(body.studentId || '');

    if (action !== 'reopen') {
      return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
    }
    if (!homeworkSetId || !studentId) {
      return NextResponse.json({ error: 'homeworkSetId and studentId are required' }, { status: 400 });
    }

    const submission = await reopenHomeworkSubmission(homeworkSetId, studentId, email);
    return NextResponse.json({ success: true, submission });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : 'Failed to perform submission action';
    const status = message === 'Submission not found' ? 404 : 500;
    console.error('Error performing homework submission action:', error);
    return NextResponse.json({ error: message }, { status });
  }
}
