import { NextRequest, NextResponse } from 'next/server';
import config from '../../../config';

const SERVER_BASE = config.serverUrl;

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${SERVER_BASE}/admin/exam-sessions`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Disable caching for admin data
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching exam sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exam sessions' },
      { status: 500 }
    );
  }
} 