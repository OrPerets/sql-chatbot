import { NextRequest, NextResponse } from 'next/server'
import { getAIAnalysisEngine } from '@/lib/ai-analysis-engine'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { studentId, analysisType = 'manual', triggerReason = 'Manual analysis requested' } = body

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      )
    }

    // Get AI analysis engine
    const aiEngine = await getAIAnalysisEngine()

    // Perform analysis
    const analysis = await aiEngine.analyzeStudent({
      studentId,
      analysisType: analysisType as 'scheduled' | 'triggered' | 'manual',
      triggerReason
    })

    return NextResponse.json({
      success: true,
      data: analysis,
      message: 'Student analysis completed successfully'
    })

  } catch (error) {
    console.error('Error analyzing student issues:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to analyze student issues',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
