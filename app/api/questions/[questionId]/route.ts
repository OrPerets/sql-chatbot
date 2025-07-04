import { NextRequest, NextResponse } from 'next/server';
import config from '../../../config';

// DELETE a question (reject)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { questionId: string } }
) {
  try {
    const questionId = params.questionId;

    // Send delete request to the mentor-server
    const response = await fetch(`${config.serverUrl}/api/exercises/${questionId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to delete question from backend' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH to update a question
export async function PATCH(
  request: NextRequest,
  { params }: { params: { questionId: string } }
) {
  try {
    const questionId = params.questionId;
    const body = await request.json();
    const { difficulty, question, solution_example } = body;

    // Send update request to the mentor-server
    const response = await fetch(`${config.serverUrl}/api/exercises/${questionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        difficulty,
        question,
        solution_example
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to update question in backend' },
        { status: response.status }
      );
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating question:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 