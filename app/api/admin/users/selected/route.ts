import { NextResponse } from 'next/server';
import { AdminAuthError, requireAdmin } from '@/lib/admin-auth';
import { getAllUsers } from '@/lib/users';

export async function POST(request: Request) {
  try {
    await requireAdmin(request);

    const data = await request.json();
    const { emails } = data as { emails: string[] };

    const users = await getAllUsers();
    const selected = Array.isArray(users)
      ? users
          .filter((u) => emails.includes(u.email))
          .map(({ password, ...safeUser }) => safeUser)
      : [];
    return NextResponse.json(selected);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    console.error('Error fetching selected users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch selected users' },
      { status: 500 }
    );
  }
}
