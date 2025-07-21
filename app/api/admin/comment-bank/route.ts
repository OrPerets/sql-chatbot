import { NextRequest, NextResponse } from 'next/server';
import config from '../../../config';

const SERVER_BASE = config.serverUrl;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryParams = new URLSearchParams();
    
    // Add query parameters if they exist
    if (searchParams.get('questionId')) queryParams.append('questionId', searchParams.get('questionId')!);
    if (searchParams.get('difficulty')) queryParams.append('difficulty', searchParams.get('difficulty')!);
    if (searchParams.get('searchTerm')) queryParams.append('searchTerm', searchParams.get('searchTerm')!);
    if (searchParams.get('limit')) queryParams.append('limit', searchParams.get('limit')!);
    
    const response = await fetch(`${SERVER_BASE}/api/admin/comment-bank?${queryParams.toString()}`, {
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
    console.error('Error fetching comments from bank:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments from bank' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const response = await fetch(`${SERVER_BASE}/api/admin/comment-bank`, {
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
    console.error('Error saving comment to bank:', error);
    return NextResponse.json(
      { error: 'Failed to save comment to bank' },
      { status: 500 }
    );
  }
} 