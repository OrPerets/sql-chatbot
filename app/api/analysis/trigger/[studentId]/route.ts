import { NextRequest, NextResponse } from 'next/server'
import { checkAnalysisTriggers, analyzeStudent } from '@/lib/ai-analysis-engine'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ studentId: string }> }
) {
  try {
    const params = await context.params
    const { studentId } = params
    const body = await request.json()
    
    const { reason, priority = 'normal' } = body

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      )
    }

    // Check if analysis should be triggered
    const triggerCheck = await checkAnalysisTriggers(studentId)
    
    if (!triggerCheck.shouldAnalyze && !reason) {
      return NextResponse.json({
        success: true,
        data: {
          shouldAnalyze: false,
          reason: triggerCheck.reason
        },
        message: 'No analysis needed at this time'
      })
    }

    // Perform analysis
    const analysis = await analyzeStudent({
      studentId,
      analysisType: 'manual',
      triggerReason: reason || triggerCheck.reason
    })

    return NextResponse.json({
      success: true,
      data: analysis,
      message: 'Analysis completed successfully'
    })

  } catch (error) {
    console.error('Error triggering analysis:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to trigger analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ studentId: string }> }
) {
  try {
    const params = await context.params
    const { studentId } = params

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'Student ID is required' },
        { status: 400 }
      )
    }

    // Check if analysis should be triggered
    const triggerCheck = await checkAnalysisTriggers(studentId)

    return NextResponse.json({
      success: true,
      data: triggerCheck,
      message: 'Trigger check completed'
    })

  } catch (error) {
    console.error('Error checking analysis triggers:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check analysis triggers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
