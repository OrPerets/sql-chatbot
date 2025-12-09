import { NextRequest, NextResponse } from 'next/server';
import { getAIAnalysisService } from '@/lib/ai-analysis';
import { getAnalysisService, saveAnalysisResult } from '@/lib/analysis-service';
import { getSubmissionsService } from '@/lib/submissions';
import { getQuestionsService } from '@/lib/questions';
import type { AnalysisRequest } from '@/lib/ai-analysis';

interface RouteParams {
  params: { setId: string };
}

/**
 * POST /api/submissions/[setId]/analyze
 * Trigger AI analysis for a specific submission in a homework set
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { setId } = params;
    
    if (!setId) {
      return NextResponse.json(
        { error: 'Homework set ID is required' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => ({}));
    const { submissionId, studentId } = body;
    
    if (!submissionId && !studentId) {
      return NextResponse.json(
        { error: 'Either submissionId or studentId is required' },
        { status: 400 }
      );
    }

    // Get submission
    const submissionsService = await getSubmissionsService();
    let submission;
    
    if (submissionId) {
      submission = await submissionsService.getSubmissionById(submissionId);
    } else if (studentId) {
      submission = await submissionsService.getSubmissionForStudent(setId, studentId);
    }
    
    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
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

    // Check if analysis already exists
    const analysisService = await getAnalysisService();
    const existingAnalyses = await analysisService.getAnalysisResultsForSubmission(submission.id);
    
    if (existingAnalyses.length > 0 && !body.force) {
      return NextResponse.json({
        message: 'Analysis already exists for this submission',
        existingAnalyses: existingAnalyses.map(a => ({
          id: a.id,
          status: a.status,
          confidence: a.confidence,
          createdAt: a.metadata.createdAt,
        })),
      });
    }

    // Perform AI analysis
    const analysisRequest: AnalysisRequest = {
      submissionId: submission.id,
      analysisTypes: body.analysisTypes || ['failure_analysis'],
      includeDetailedFeedback: body.includeDetailedFeedback || true,
      customPrompts: body.customPrompts || {},
    };

    const aiService = getAIAnalysisService();
    const analysis = await aiService.analyzeSubmission(submission, questions, analysisRequest);

    // Save analysis result
    const savedAnalysis = await saveAnalysisResult(analysis);

    return NextResponse.json({
      message: 'Analysis completed successfully',
      analysis: {
        id: savedAnalysis.id,
        status: savedAnalysis.status,
        confidence: savedAnalysis.confidence,
        results: savedAnalysis.results,
        metadata: savedAnalysis.metadata,
      },
    });

  } catch (error: any) {
    console.error('Analysis API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to analyze submission',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/submissions/[setId]/analyze
 * Get analysis results for submissions in a homework set
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { setId } = params;
    const { searchParams } = new URL(request.url);
    const submissionId = searchParams.get('submissionId');
    const studentId = searchParams.get('studentId');
    
    if (!setId) {
      return NextResponse.json(
        { error: 'Homework set ID is required' },
        { status: 400 }
      );
    }

    const analysisService = await getAnalysisService();
    let analyses;

    if (submissionId) {
      // Get analysis for specific submission
      analyses = await analysisService.getAnalysisResultsForSubmission(submissionId);
    } else if (studentId) {
      // Get analysis for specific student in this homework set
      analyses = await analysisService.getAnalysisResultsForStudent(studentId, setId);
    } else {
      // Get all analyses for this homework set
      analyses = await analysisService.getAnalysisResultsForHomeworkSet(setId);
    }

    return NextResponse.json({
      homeworkSetId: setId,
      submissionId: submissionId || null,
      studentId: studentId || null,
      analyses: analyses.map(analysis => ({
        id: analysis.id,
        submissionId: analysis.submissionId,
        studentId: analysis.studentId,
        analysisType: analysis.analysisType,
        status: analysis.status,
        confidence: analysis.confidence,
        results: analysis.results,
        metadata: analysis.metadata,
      })),
    });

  } catch (error: any) {
    console.error('Get analysis API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve analysis results',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
