import { NextResponse } from 'next/server';

import { AdminAuthError, requireAdmin } from '@/lib/admin-auth';
import {
  deleteHomeworkAccessOverride,
  upsertHomeworkAccessOverride,
} from '@/lib/homework-access-overrides';

export const dynamic = 'force-dynamic';

export async function PUT(request: Request) {
  try {
    const { email: actorEmail } = await requireAdmin(request);
    const body = await request.json();
    const override = await upsertHomeworkAccessOverride({
      homeworkSetId: String(body.homeworkSetId || ''),
      userEmail: String(body.userEmail || ''),
      availableFrom: String(body.availableFrom || ''),
      availableUntil: String(body.availableUntil || ''),
      actorEmail,
    });

    return NextResponse.json({ success: true, override });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : 'Failed to save access override';
    const status = message.includes('required') || message.includes('valid') || message.includes('before') ? 400 : 500;
    console.error('Error saving homework access override:', error);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const deleted = await deleteHomeworkAccessOverride(
      searchParams.get('homeworkSetId') || '',
      searchParams.get('userEmail') || '',
    );

    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.error('Error deleting homework access override:', error);
    return NextResponse.json({ error: 'Failed to clear access override' }, { status: 500 });
  }
}
