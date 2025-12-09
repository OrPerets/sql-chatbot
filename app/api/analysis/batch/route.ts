import { NextRequest, NextResponse } from 'next/server'
import { analyzeStudent } from '@/lib/ai-analysis-engine'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const { studentIds, analysisType = 'batch' } = body

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'studentIds array is required' },
        { status: 400 }
      )
    }

    if (studentIds.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Maximum 50 students can be analyzed in a single batch' },
        { status: 400 }
      )
    }

    const results = []
    const errors = []

    // Process students in parallel with concurrency limit
    const concurrencyLimit = 5
    const chunks = []
    
    for (let i = 0; i < studentIds.length; i += concurrencyLimit) {
      chunks.push(studentIds.slice(i, i + concurrencyLimit))
    }

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (studentId: string) => {
        try {
          const analysis = await analyzeStudent({
            studentId,
            analysisType: 'scheduled',
            triggerReason: `Batch analysis - ${analysisType}`
          })
          return { studentId, analysis, error: null }
        } catch (error) {
          console.error(`Error analyzing student ${studentId}:`, error)
          return { 
            studentId, 
            analysis: null, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          }
        }
      })

      const chunkResults = await Promise.all(chunkPromises)
      results.push(...chunkResults)
    }

    // Separate successful analyses from errors
    const successfulAnalyses = results.filter(r => r.analysis !== null)
    const failedAnalyses = results.filter(r => r.error !== null)

    return NextResponse.json({
      success: true,
      data: {
        totalRequested: studentIds.length,
        successful: successfulAnalyses.length,
        failed: failedAnalyses.length,
        analyses: successfulAnalyses.map(r => ({
          studentId: r.studentId,
          analysis: r.analysis
        })),
        errors: failedAnalyses.map(r => ({
          studentId: r.studentId,
          error: r.error
        }))
      },
      message: `Batch analysis completed: ${successfulAnalyses.length}/${studentIds.length} successful`
    })

  } catch (error) {
    console.error('Error in batch analysis:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to perform batch analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
