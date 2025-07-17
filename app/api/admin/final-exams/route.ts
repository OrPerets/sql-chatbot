import { NextRequest, NextResponse } from 'next/server';
import config from '../../../config';

const SERVER_BASE = config.serverUrl;

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${SERVER_BASE}/admin/final-exams`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Disable caching for admin data
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching final exams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch final exams' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Initialize FinalExams collection
    const response = await fetch(`${SERVER_BASE}/admin/initialize-final-exams`, {
      method: 'POST',
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
    console.error('Error initializing final exams:', error);
    return NextResponse.json(
      { error: 'Failed to initialize final exams' },
      { status: 500 }
    );
  }
} 