import { NextRequest, NextResponse } from 'next/server';
import config from '../../../config';

const SERVER_BASE = config.serverUrl;

export async function GET() {
  try {
    // Fetch approved questions from the backend
    const response = await fetch(`${SERVER_BASE}/api/admin/questions-with-answers`, {
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
    console.error('Error fetching questions with answers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions with answers' },
      { status: 500 }
    );
  }
} 