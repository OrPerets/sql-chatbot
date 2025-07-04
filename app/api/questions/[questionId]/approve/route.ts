import { NextRequest, NextResponse } from 'next/server';
import config from '../../../../config';

// POST to approve a question
export async function POST(
  request: NextRequest,
  { params }: { params: { questionId: string } }
) {
  try {
    const questionId = params.questionId;

    // Send approve request to the mentor-server
    const response = await fetch(`${config.serverUrl}/api/exercises/${questionId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to approve question in backend' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error approving question:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 