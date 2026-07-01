import { NextResponse } from 'next/server';

import { AdminAuthError, requireAdmin } from '@/lib/admin-auth';
import { getAdminHomeworkManagementPayload } from '@/lib/admin-homework-management';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
    const { searchParams } = new URL(request.url);
    const setId = searchParams.get('setId');
    const payload = await getAdminHomeworkManagementPayload(setId);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    console.error('Error loading admin homework management payload:', error);
    return NextResponse.json({ error: 'Failed to load homework management data' }, { status: 500 });
  }
}
