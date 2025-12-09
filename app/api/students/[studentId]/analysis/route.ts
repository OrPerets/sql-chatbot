import { NextRequest, NextResponse } from 'next/server';
import { getAnalysisService } from '@/lib/analysis-service';

interface RouteParams {
  params: { studentId: string };
}

/**
 * GET /api/students/[studentId]/analysis
 * Get analysis results for a specific student
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { studentId } = params;
    const { searchParams } = new URL(request.url);
    const homeworkSetId = searchParams.get('homeworkSetId');
    
    if (!studentId) {
      return NextResponse.json(
        { error: 'Student ID is required' },
        { status: 400 }
      );
    }

    const analysisService = await getAnalysisService();
    const analyses = await analysisService.getAnalysisResultsForStudent(
      studentId, 
      homeworkSetId || undefined
    );

    // Group analyses by homework set
    const analysesByHomeworkSet = analyses.reduce((acc, analysis) => {
      if (!acc[analysis.homeworkSetId]) {
        acc[analysis.homeworkSetId] = [];
      }
      acc[analysis.homeworkSetId].push(analysis);
      return acc;
    }, {} as Record<string, typeof analyses>);

    // Calculate student progress summary
    const progressSummary = {
      totalAnalyses: analyses.length,
      completedAnalyses: analyses.filter(a => a.status === 'completed').length,
      averageConfidence: analyses.length > 0 
        ? analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length 
        : 0,
      commonErrorPatterns: [] as Array<{ pattern: string; count: number }>,
      topRecommendations: [] as Array<{ type: string; count: number }>,
    };

    // Extract common patterns and recommendations
    const errorPatterns: Record<string, number> = {};
    const recommendations: Record<string, number> = {};

    for (const analysis of analyses) {
      if (analysis.status === 'completed' && analysis.results) {
        if (analysis.results.errorPatterns) {
          for (const pattern of analysis.results.errorPatterns) {
            errorPatterns[pattern.pattern] = (errorPatterns[pattern.pattern] || 0) + 1;
          }
        }

        if (analysis.results.recommendations) {
          for (const rec of analysis.results.recommendations) {
            recommendations[rec.type] = (recommendations[rec.type] || 0) + 1;
          }
        }
      }
    }

    progressSummary.commonErrorPatterns = Object.entries(errorPatterns)
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    progressSummary.topRecommendations = Object.entries(recommendations)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return NextResponse.json({
      studentId,
      homeworkSetId: homeworkSetId || 'all',
      progressSummary,
      analysesByHomeworkSet: Object.entries(analysesByHomeworkSet).map(([setId, setAnalyses]) => ({
        homeworkSetId: setId,
        analyses: setAnalyses.map(analysis => ({
          id: analysis.id,
          submissionId: analysis.submissionId,
          analysisType: analysis.analysisType,
          status: analysis.status,
          confidence: analysis.confidence,
          results: analysis.results,
          metadata: analysis.metadata,
        })),
      })),
    });

  } catch (error: any) {
    console.error('Get student analysis API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve student analysis results',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
