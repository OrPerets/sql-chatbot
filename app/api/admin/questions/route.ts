import { NextRequest, NextResponse } from 'next/server';
import config from '../../../config';

const SERVER_BASE = config.serverUrl;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Forward all query parameters
    const queryString = searchParams.toString();
    const apiEndpoint = `${SERVER_BASE}/api/admin/questions${queryString ? `?${queryString}` : ''}`;
    
    const response = await fetch(apiEndpoint, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    // Return with cache control
    const jsonResponse = NextResponse.json(data);
    jsonResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    jsonResponse.headers.set('Pragma', 'no-cache');
    jsonResponse.headers.set('Expires', '0');
    
    return jsonResponse;
  } catch (error) {
    console.error('Error proxying unified questions request:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch unified questions',
        questions: [],
        totalPages: 1,
        totalQuestions: 0,
        currentPage: 1,
        hasMore: false
      },
      { status: 500 }
    );
  }
}
