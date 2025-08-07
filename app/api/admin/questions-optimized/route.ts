import { NextRequest, NextResponse } from 'next/server';
import config from '../../../config';

const SERVER_BASE = config.serverUrl;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract pagination and filter parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const difficulty = searchParams.get('difficulty') || 'all';
    const gradingStatus = searchParams.get('gradingStatus') || 'all';
    const includeGradingStatus = searchParams.get('includeGradingStatus') === 'true';
    const questionId = searchParams.get('questionId');
    
    console.log(`🚀 Optimized API: fetching page ${page} with ${limit} questions${questionId ? ` (questionId: ${questionId})` : ''}`);
    console.log(`🔧 Debug: Connecting to server: ${SERVER_BASE}`);
    
    // Build query parameters for the backend server
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      includeGradingStatus: includeGradingStatus.toString()
    });
    
    if (search && search.trim()) {
      queryParams.append('search', search.trim());
    }
    
    if (difficulty && difficulty !== 'all') {
      queryParams.append('difficulty', difficulty);
    }
    
    if (gradingStatus && gradingStatus !== 'all') {
      queryParams.append('gradingStatus', gradingStatus);
    }
    
    if (questionId) {
      queryParams.append('questionId', questionId);
    }
    
    // Use the new optimized backend endpoint
    const response = await fetch(`${SERVER_BASE}/api/admin/questions-optimized?${queryParams.toString()}`, {
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
    
    console.log(`✅ Optimized API: returning ${data.questions?.length || 0} questions`);
    
    // Create response with cache-busting headers
    const jsonResponse = NextResponse.json(data);
    jsonResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    jsonResponse.headers.set('Pragma', 'no-cache');
    jsonResponse.headers.set('Expires', '0');
    
    return jsonResponse;
  } catch (error) {
    console.error('Error fetching optimized questions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch optimized questions',
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