import { NextResponse } from 'next/server';
import config from '../../../../config';

const SERVER_BASE = config.serverUrl;

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const { emails } = data;

    // Forward request to main server to get selected users' data
    const response = await fetch(`${SERVER_BASE}/users/selected`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ emails })
    });

    if (!response.ok) {
      throw new Error('Failed to fetch selected users');
    }

    const users = await response.json();
    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching selected users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch selected users' },
      { status: 500 }
    );
  }
}
