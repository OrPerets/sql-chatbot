import { NextRequest, NextResponse } from 'next/server';

const SERVER_BASE = process.env.NEXT_PUBLIC_SERVER_BASE || 'https://mentor-server-theta.vercel.app';

export async function GET(req: NextRequest) {
  try {
    const response = await fetch(`${SERVER_BASE}/admin/research/test`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json({
      frontend: {
        status: 'success',
        serverUrl: SERVER_BASE,
        timestamp: new Date()
      },
      backend: data
    });
  } catch (error) {
    console.error('Error testing backend connection:', error);
    return NextResponse.json(
      { 
        error: 'Failed to connect to backend',
        serverUrl: SERVER_BASE,
        details: error.message 
      },
      { status: 500 }
    );
  }
} 