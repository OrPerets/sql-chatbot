import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { emails } = data as { emails: string[] };

    const response = await fetch(`/api/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch users');
    }

    const users = await response.json();
    const selected = Array.isArray(users) ? users.filter((u) => emails.includes(u.email)) : [];
    return NextResponse.json(selected);
  } catch (error) {
    console.error('Error fetching selected users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch selected users' },
      { status: 500 }
    );
  }
}
