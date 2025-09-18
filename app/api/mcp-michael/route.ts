import { NextRequest, NextResponse } from 'next/server';
import config from '../../config';

const SERVER_BASE = config.serverUrl;

export async function GET() {
  try {
    const response = await fetch(`${SERVER_BASE}/weekly-content`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching weekly content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weekly content' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.week || body.week < 1 || body.week > 14) {
      return NextResponse.json(
        { error: 'Week must be between 1 and 14' },
        { status: 400 }
      );
    }

    const response = await fetch(`${SERVER_BASE}/weekly-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error saving weekly content:', error);
    return NextResponse.json(
      { error: 'Failed to save weekly content' },
      { status: 500 }
    );
  }
}
