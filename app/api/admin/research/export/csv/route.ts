import { NextRequest, NextResponse } from 'next/server';

const SERVER_BASE = process.env.NEXT_PUBLIC_SERVER_BASE || 'https://mentor-server-theta.vercel.app';

export async function GET(req: NextRequest) {
  try {
    const response = await fetch(`${SERVER_BASE}/admin/research/export/csv`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const csvData = await response.text();
    
    return new NextResponse(csvData, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="exam-research-data.csv"',
      },
    });
  } catch (error) {
    console.error('Error exporting CSV data:', error);
    return NextResponse.json(
      { error: 'Failed to export CSV data' },
      { status: 500 }
    );
  }
} 