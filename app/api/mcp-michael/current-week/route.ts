import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering to avoid static generation issues
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Always use semester-start with current week to normalize contract
    const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const url = `${baseUrl}/api/content/semester-start?withCurrentWeek=1`;

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

    // Expected shape from semester-start route: { startDate, currentWeek?: { week, content, dateRange } }
    if (!data?.startDate) {
      return NextResponse.json({
        weekNumber: null,
        content: null,
        dateRange: null,
        message: 'Semester start date is not configured. Please set it in the admin panel.'
      });
    }

    const cw = data.currentWeek || {};
    const weekNumber = typeof cw.week === 'number' ? cw.week : null;
    const content = typeof cw.content === 'string' && cw.content.trim() ? cw.content : null;
    const dateRange = typeof cw.dateRange === 'string' && cw.dateRange.trim() ? cw.dateRange : null;

    return NextResponse.json({ weekNumber, content, dateRange });
  } catch (error) {
    console.error('Error fetching current week content:', error);
    return NextResponse.json({
      weekNumber: null,
      content: null,
      dateRange: null,
      message: 'Failed to fetch current week content'
    }, { status: 500 });
  }
}
