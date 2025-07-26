import { NextRequest, NextResponse } from 'next/server';
import config from '../../../config';

const SERVER_BASE = config.serverUrl;

// Timeout configuration for Vercel
const VERCEL_TIMEOUT = 45000; // 45 seconds to stay under Vercel's 60s limit
const MAX_QUESTIONS_PER_REQUEST = 3; // Reduced from 5 to prevent timeouts

export async function POST(request: NextRequest) {
  try {
    const { questionIds } = await request.json();
    
    if (!questionIds || !Array.isArray(questionIds)) {
      return NextResponse.json(
        { error: 'questionIds array is required' },
        { status: 400 }
      );
    }

    // Limit the number of questions to process to prevent timeout
    if (questionIds.length > MAX_QUESTIONS_PER_REQUEST) {
      console.warn(`⚠️ Too many questions requested (${questionIds.length}), limiting to ${MAX_QUESTIONS_PER_REQUEST}`);
      const limitedIds = questionIds.slice(0, MAX_QUESTIONS_PER_REQUEST);
      
      return NextResponse.json(
        { 
          error: `Too many questions requested. Please request ${MAX_QUESTIONS_PER_REQUEST} or fewer questions at a time.`,
          suggestedChunkSize: MAX_QUESTIONS_PER_REQUEST,
          originalRequestSize: questionIds.length
        },
        { status: 400 }
      );
    }

    console.log(`📊 Fetching completion data for ${questionIds.length} questions from server...`);
    
    try {
      // Create a promise that will timeout after 45 seconds
      const fetchPromise = fetch(`${SERVER_BASE}/api/admin/questions-completion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questionIds }),
        cache: 'no-store',
        signal: AbortSignal.timeout(VERCEL_TIMEOUT)
      });

      const response = await fetchPromise;

      if (!response.ok) {
        console.error(`❌ Server error: ${response.status} ${response.statusText}`);
        
        // Return fallback data if server fails
        return NextResponse.json(
          createFallbackCompletionData(questionIds),
          { status: 200 }
        );
      }

      const data = await response.json();
      console.log(`✅ Completion data received for ${Object.keys(data).length} questions`);
      
      // Validate and enhance the response data
      const validatedData = validateAndEnhanceCompletionData(data, questionIds);
      
      return NextResponse.json(validatedData);
      
    } catch (fetchError: any) {
      console.error('❌ Fetch error:', fetchError.message);
      
      // Handle specific timeout errors
      if (fetchError.name === 'TimeoutError' || fetchError.message.includes('timeout')) {
        console.warn('⏰ Server request timed out, returning fallback data');
        return NextResponse.json(
          createFallbackCompletionData(questionIds),
          { status: 200 }
        );
      }
      
      // Handle connection errors
      if (fetchError.name === 'TypeError' || fetchError.message.includes('fetch')) {
        console.warn('🔌 Connection error, returning fallback data');
        return NextResponse.json(
          createFallbackCompletionData(questionIds),
          { status: 200 }
        );
      }
      
      throw fetchError;
    }
    
  } catch (error: any) {
    console.error('💥 Critical error in questions-completion:', error);
    
    // Always return some data to prevent frontend crashes
    const fallbackQuestionIds = Array.isArray(error.questionIds) ? error.questionIds : [];
    
    return NextResponse.json(
      createFallbackCompletionData(fallbackQuestionIds),
      { status: 200 } // Return 200 with fallback data instead of 500
    );
  }
}

// Create fallback completion data when server is unavailable
function createFallbackCompletionData(questionIds: number[]) {
  const fallbackData: Record<number, any> = {};
  
  questionIds.forEach(questionId => {
    fallbackData[questionId] = {
      id: questionId,
      gradedCount: 0,
      ungradedCount: 0,
      isCompleted: false,
      completionPercentage: 0,
      averageScore: 0,
      totalAnswers: 0,
      isFallback: true // Flag to indicate this is fallback data
    };
  });
  
  console.log(`🔄 Created fallback completion data for ${questionIds.length} questions`);
  return fallbackData;
}

// Validate and enhance completion data from server
function validateAndEnhanceCompletionData(data: any, requestedQuestionIds: number[]) {
  const validatedData: Record<number, any> = {};
  
  requestedQuestionIds.forEach(questionId => {
    const questionData = data[questionId];
    
    if (questionData) {
      // Ensure all required fields exist with sensible defaults
      validatedData[questionId] = {
        id: questionId,
        gradedCount: questionData.gradedCount || 0,
        ungradedCount: questionData.ungradedCount || 0,
        isCompleted: questionData.isCompleted || false,
        completionPercentage: questionData.completionPercentage || 0,
        averageScore: questionData.averageScore || 0,
        totalAnswers: questionData.totalAnswers || (questionData.gradedCount || 0) + (questionData.ungradedCount || 0),
        isFallback: false
      };
    } else {
      // Create fallback for missing question data
      validatedData[questionId] = {
        id: questionId,
        gradedCount: 0,
        ungradedCount: 0,
        isCompleted: false,
        completionPercentage: 0,
        averageScore: 0,
        totalAnswers: 0,
        isFallback: true
      };
    }
  });
  
  return validatedData;
} 