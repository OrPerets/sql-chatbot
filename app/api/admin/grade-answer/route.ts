import { NextRequest, NextResponse } from 'next/server';
import config from '../../../config';

const SERVER_BASE = config.serverUrl;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${SERVER_BASE}/api/admin/grade-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error saving answer grade:', error);
    return NextResponse.json(
      { error: 'Failed to save answer grade' },
      { status: 500 }
    );
  }
} 