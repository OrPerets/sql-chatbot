import { NextRequest, NextResponse } from 'next/server';
import config from '../../../config';

const SERVER_BASE = config.serverUrl;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const semesterStart = searchParams.get('semesterStart');

    let url = `${SERVER_BASE}/weekly-content/current`;
    if (semesterStart) {
      url += `?semesterStart=${encodeURIComponent(semesterStart)}`;
    }

    const response = await fetch(url, {
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
    console.error('Error fetching current week content:', error);
    return NextResponse.json(
      { error: 'Failed to fetch current week content' },
      { status: 500 }
    );
  }
}
