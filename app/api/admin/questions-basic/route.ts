import { NextRequest, NextResponse } from 'next/server';
import config from '../../../config';

const SERVER_BASE = config.serverUrl;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract pagination and filter parameters - FORCE TO 2 questions per page
    const page = parseInt(searchParams.get('page') || '1');
    const limit = 2; // FIXED AT 2 for immediate grading
    const search = searchParams.get('search') || '';
    const difficulty = searchParams.get('difficulty') || 'all';
    const gradingStatus = searchParams.get('gradingStatus') || 'all';
    
    console.log(`🚀 Fetching 2 questions for page ${page} with filters:`, {
      search: search.substring(0, 50),
      difficulty,
      gradingStatus
    });
    
    // Build query parameters for the backend server
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
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
    
    // Use the working backend server endpoint with query parameters
    const response = await fetch(`${SERVER_BASE}/api/admin/questions-basic?${queryParams.toString()}`, {
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
    
    // Ensure the response includes pagination info
    const responseData = {
      questions: data.questions || data || [], // Handle both formats
      totalPages: data.totalPages || Math.ceil((data.totalQuestions || data.length || 0) / limit),
      totalQuestions: data.totalQuestions || data.length || 0,
      currentPage: page,
      hasMore: data.hasMore || (page * limit < (data.totalQuestions || data.length || 0)),
      questionsPerPage: limit
    };
    
    console.log(`✅ Fetched ${responseData.questions.length} questions (page ${page}/${responseData.totalPages}) - READY FOR GRADING`);
    
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching basic questions:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch basic questions',
        questions: [],
        totalPages: 1,
        totalQuestions: 0,
        currentPage: 1,
        hasMore: false,
        questionsPerPage: 2
      },
      { status: 500 }
    );
  }
} 