import { NextRequest, NextResponse } from 'next/server';
import config from '../../../../../config';

const SERVER_BASE = config.serverUrl;

export async function GET(
  request: NextRequest,
  { params }: { params: { questionId: string } }
) {
  try {
    const { questionId } = params;
    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    
    console.log(`🔄 Optimized answers API: question ${questionId}, page ${page}, limit ${limit}`);
    
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });
    
    const response = await fetch(`${SERVER_BASE}/api/admin/question/${questionId}/answers-optimized?${queryParams.toString()}`, {
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
    
    console.log(`✅ Optimized answers API: returning ${data.answers?.length || 0} answers`);
    
    // Create response with strong cache-busting headers
    const jsonResponse = NextResponse.json(data);
    jsonResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    jsonResponse.headers.set('Pragma', 'no-cache');
    jsonResponse.headers.set('Expires', '0');
    jsonResponse.headers.set('Surrogate-Control', 'no-store');
    
    return jsonResponse;
  } catch (error) {
    console.error('Error fetching optimized question answers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch optimized question answers' },
      { status: 500 }
    );
  }
} 