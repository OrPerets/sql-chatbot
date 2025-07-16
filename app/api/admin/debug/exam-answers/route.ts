import { NextRequest, NextResponse } from 'next/server';
import config from '../../../../config';

const SERVER_BASE = config.serverUrl;

export async function GET() {
  try {
    const response = await fetch(`${SERVER_BASE}/api/admin/debug/exam-answers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching debug data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch debug data' },
      { status: 500 }
    );
  }
} 