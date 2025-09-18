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
        // Emergency override: add +30 minutes (25%) even if not found in backend
        const emergencyExtraMinutes = 30;
        const baseMinutes = 120;
        const emergencyExtraPercentage = Math.round((emergencyExtraMinutes / baseMinutes) * 100); // 25

        return NextResponse.json(
          {
            studentId,
            percentage: emergencyExtraPercentage,
            hasExtraTime: emergencyExtraPercentage > 0
          },
          {
            status: 200,
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            }
          }
        );
      }
      
      const errorData = await response.json();
      return NextResponse.json(
        { error: 'Failed to fetch extra time data', details: errorData },
        { status: 500 }
      );
    }

    const extraTimeData = await response.json();

    // Emergency override: add +30 minutes (25%) to whatever the backend provides
    const emergencyExtraMinutes = 30;
    const baseMinutes = 120;
    const emergencyExtraPercentage = Math.round((emergencyExtraMinutes / baseMinutes) * 100); // 25

    const backendPercentage = extraTimeData.percentage || 0;
    const combinedPercentage = backendPercentage + emergencyExtraPercentage;

    return NextResponse.json(
      {
        studentId,
        percentage: combinedPercentage,
        hasExtraTime: combinedPercentage > 0,
        createdAt: extraTimeData.createdAt
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );

  } catch (error) {
    console.error('Error fetching extra time:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 