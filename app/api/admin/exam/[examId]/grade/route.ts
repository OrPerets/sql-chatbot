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
    
    let response = await fetch(`${SERVER_BASE}/admin/exam/${examId}/grade`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Fallback: try final-exam grade endpoint if regular exam not found
    if (!response.ok) {
      const status = response.status;
      try {
        const alt = await fetch(`${SERVER_BASE}/admin/final-exam/${examId}/grade`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        if (alt.ok) {
          const data = await alt.json();
          return NextResponse.json(data);
        }
      } catch {}
      // If both fail, pass through original status
      return NextResponse.json({ error: 'Grade not found' }, { status });
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