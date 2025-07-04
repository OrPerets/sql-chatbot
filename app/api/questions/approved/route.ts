import { NextRequest, NextResponse } from 'next/server';
import config from '../../../config';

// GET all approved questions from the backend
export async function GET() {
  try {
    // Fetch approved questions from the mentor-server
    const response = await fetch(`${config.serverUrl}/api/exercises/approved`);
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch approved questions from backend' },
        { status: response.status }
      );
    }

    const questions = await response.json();
    return NextResponse.json(questions);
  } catch (error) {
    console.error('Error fetching approved questions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 