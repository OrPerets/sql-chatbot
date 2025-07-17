import { NextRequest, NextResponse } from 'next/server';

const SERVER_BASE = process.env.NEXT_PUBLIC_SERVER_BASE || 'https://mentor-server-theta.vercel.app';

export async function GET(req: NextRequest) {
  try {
    const response = await fetch(`${SERVER_BASE}/admin/research/analytics`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Disable caching for admin analytics data
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
} 