import { NextRequest, NextResponse } from 'next/server';
import config from '../../../config';

const SERVER_BASE = config.serverUrl;

export async function GET() {
  try {
    const response = await fetch(`${SERVER_BASE}/api/admin/check-missing-answers`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error checking missing answers:', error);
    return NextResponse.json(
      { error: 'Failed to check missing answers' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const response = await fetch(`${SERVER_BASE}/api/admin/fix-missing-answers`, {
      method: 'POST',
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
    console.error('Error fixing missing answers:', error);
    return NextResponse.json(
      { error: 'Failed to fix missing answers' },
      { status: 500 }
    );
  }
} 