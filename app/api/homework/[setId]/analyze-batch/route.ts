import { NextRequest, NextResponse } from 'next/server';
import { getAIAnalysisService } from '@/lib/ai-analysis';
import { getAnalysisService, saveAnalysisResult } from '@/lib/analysis-service';
import { getSubmissionsService } from '@/lib/submissions';
import { getQuestionsService } from '@/lib/questions';
import type { AnalysisRequest } from '@/lib/ai-analysis';

interface RouteParams {
  params: Promise<{ setId: string }>;
}

/**
 * POST /api/homework/[setId]/analyze-batch
 * Batch analyze multiple submissions for a homework set
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { setId } = await params;
    
    if (!setId) {
      return NextResponse.json(
        { error: 'Homework set ID is required' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const {
      studentIds = [],
      analysisTypes = ['failure_analysis'],
      includeDetailedFeedback = true,
      customPrompts = {},
      force = false,
    } = body;

    // Get submissions for the homework set
    const submissionsService = await getSubmissionsService();
    const submissions = await submissionsService.getSubmissionSummaries(setId);
    
    if (submissions.length === 0) {
      return NextResponse.json(
        { error: 'No submissions found for this homework set' },
        { status: 404 }
      );
    }

    // Filter by student IDs if provided
    const filteredSubmissions = studentIds.length > 0 
      ? submissions.filter(s => studentIds.includes(s.studentId))
      : submissions;

    if (filteredSubmissions.length === 0) {
      return NextResponse.json(
        { error: 'No submissions found for the specified students' },
        { status: 404 }
      );
    }

    // Get questions for the homework set
    const questionsService = await getQuestionsService();
    const questions = await questionsService.getQuestionsByHomeworkSet(setId);
    
    if (questions.length === 0) {
      return NextResponse.json(
        { error: 'No questions found for this homework set' },
        { status: 404 }
      );
    }

    // Get full submission details
    const fullSubmissions = await Promise.all(
      filteredSubmissions.map(s => submissionsService.getSubmissionById(s.id))
    );
    
    const validSubmissions = fullSubmissions.filter(s => s !== null);

    if (validSubmissions.length === 0) {
      return NextResponse.json(
        { error: 'No valid submissions found' },
        { status: 404 }
      );
    }

    // Check existing analyses
    const analysisService = await getAnalysisService();
    const existingAnalyses = await analysisService.getAnalysisResultsForHomeworkSet(setId);
    const existingSubmissionIds = new Set(existingAnalyses.map(a => a.submissionId));

    // Filter out submissions that already have analyses (unless force is true)
    const submissionsToAnalyze = force 
      ? validSubmissions
      : validSubmissions.filter(s => !existingSubmissionIds.has(s!.id));

    if (submissionsToAnalyze.length === 0) {
      return NextResponse.json({
        message: 'All submissions already have analyses',
        totalSubmissions: validSubmissions.length,
        existingAnalyses: existingAnalyses.length,
      });
    }

    // Perform batch analysis
    const aiService = getAIAnalysisService();
    const analysisRequest: Omit<AnalysisRequest, 'submissionId'> = {
      analysisTypes,
      includeDetailedFeedback,
      customPrompts,
    };

    const analyses = await aiService.batchAnalyzeSubmissions(
      submissionsToAnalyze,
      questions,
      analysisRequest
    );

    // Save all analysis results
    const savedAnalyses = await Promise.all(
      analyses.map(analysis => saveAnalysisResult(analysis))
    );

    return NextResponse.json({
      message: 'Batch analysis completed successfully',
      summary: {
        totalSubmissions: validSubmissions.length,
        analyzedSubmissions: savedAnalyses.length,
        skippedSubmissions: validSubmissions.length - savedAnalyses.length,
        successfulAnalyses: savedAnalyses.filter(a => a.status === 'completed').length,
        failedAnalyses: savedAnalyses.filter(a => a.status === 'failed').length,
      },
      analyses: savedAnalyses.map(analysis => ({
        id: analysis.id,
        submissionId: analysis.submissionId,
        studentId: analysis.studentId,
        status: analysis.status,
        confidence: analysis.confidence,
        metadata: analysis.metadata,
      })),
    });

  } catch (error: any) {
    console.error('Batch analysis API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to perform batch analysis',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/homework/[setId]/analyze-batch
 * Get analysis statistics for a homework set
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { setId } = await params;
    
    if (!setId) {
      return NextResponse.json(
        { error: 'Homework set ID is required' },
        { status: 400 }
      );
    }

    const analysisService = await getAnalysisService();
    const statistics = await analysisService.getAnalysisStatistics(setId);
    const analyses = await analysisService.getAnalysisResultsForHomeworkSet(setId);

    return NextResponse.json({
      homeworkSetId: setId,
      statistics,
      recentAnalyses: analyses.slice(0, 10).map(analysis => ({
        id: analysis.id,
        submissionId: analysis.submissionId,
        studentId: analysis.studentId,
        status: analysis.status,
        confidence: analysis.confidence,
        createdAt: analysis.metadata.createdAt,
      })),
    });

  } catch (error: any) {
    console.error('Get batch analysis statistics API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve analysis statistics',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
