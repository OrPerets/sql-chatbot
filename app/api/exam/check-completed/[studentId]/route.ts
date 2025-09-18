import { NextRequest, NextResponse } from 'next/server';
import config from '../../../../config';

const SERVER_BASE = config.serverUrl;

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

    // Check with backend server if student has completed any exam
    const response = await fetch(`${SERVER_BASE}/exam/check-completed/${studentId}`, {
      method: 'GET',
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
    console.error('Error checking exam completion status:', error);
    return NextResponse.json(
      { error: 'Failed to check exam completion status' },
      { status: 500 }
    );
  }
} 