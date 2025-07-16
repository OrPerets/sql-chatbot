import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { studentId: string } }
) {
  try {
    const { studentId } = params;

    if (!studentId) {
      return NextResponse.json(
        { error: 'Student ID is required' },
        { status: 400 }
      );
    }

    // Query backend server for extra time
    const backendUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'https://mentor-server-theta.vercel.app';
    
    const response = await fetch(`${backendUrl}/exam/extraTime/${studentId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'NextJS-ExamApp/1.0',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        // No extra time found for this student
        return NextResponse.json({
          studentId,
          percentage: 0,
          hasExtraTime: false
        }, {
          status: 200,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
      }
      
      const errorData = await response.json();
      return NextResponse.json(
        { error: 'Failed to fetch extra time data', details: errorData },
        { status: 500 }
      );
    }

    const extraTimeData = await response.json();

    return NextResponse.json({
      studentId,
      percentage: extraTimeData.percentage || 0,
      hasExtraTime: extraTimeData.percentage > 0,
      createdAt: extraTimeData.createdAt
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Error fetching extra time:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 