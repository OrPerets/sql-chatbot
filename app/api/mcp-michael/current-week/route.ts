import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const semesterStart = request.nextUrl.searchParams.get('semesterStart');

    let url = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/content/weekly`; // default weekly content
    if (semesterStart) {
      url = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/content/semester-start?withCurrentWeek=1`;
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
