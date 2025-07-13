import { NextRequest, NextResponse } from 'next/server';
import config from '../../../../../config';

const SERVER_BASE = config.serverUrl;

export async function POST(
  request: NextRequest,
  { params }: { params: { examId: string } }
) {
  try {
    const { examId } = params;
    const gradeData = await request.json();
    
    const response = await fetch(`${SERVER_BASE}/admin/exam/${examId}/grade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(gradeData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error saving exam grade:', error);
    return NextResponse.json(
      { error: 'Failed to save exam grade' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { examId: string } }
) {
  try {
    const { examId } = params;
    
    const response = await fetch(`${SERVER_BASE}/admin/exam/${examId}/grade`, {
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
    console.error('Error fetching exam grade:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exam grade' },
      { status: 500 }
    );
  }
} 